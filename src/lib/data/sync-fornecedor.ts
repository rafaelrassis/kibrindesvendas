import "server-only";
import { prisma } from "@/lib/prisma";
import { enviarEmailAlertaFornecedor } from "@/lib/email";
import {
  calcularSync,
  extrairVariantesNuvemshop,
  ultimoHorarioAgendado,
  validarUrlFornecedor,
} from "@/lib/fornecedor";
import { ErroDeNegocio } from "./erros";

// Sincronização de estoque com o fornecedor: lê a página do produto no site
// dele (Nuvemshop), zera aqui o que está indisponível lá e repõe o que
// voltou. Roda em ciclos agendados (ver executarCicloAgendado, chamado pelo
// cron) ou na mão pelo admin.
//
// Cada chamada processa um lote que cabe no tempo da função serverless; o
// que sobrar fica pra próxima chamada — por isso o "quem falta" é quem tem
// fornecedorVerificadoEm anterior ao início do ciclo.

const TIMEOUT_FETCH_MS = 15_000;
const PARALELO = 3;

async function baixarPagina(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(TIMEOUT_FETCH_MS),
      cache: "no-store",
    });
  } catch (e) {
    const motivo = e instanceof Error && e.name === "TimeoutError" ? "demorou demais pra responder" : "não respondeu";
    throw new Error(`O site do fornecedor ${motivo}.`);
  }
  if (res.status === 404) throw new Error("Link quebrado (404) — o produto pode ter sido removido do fornecedor.");
  if (!res.ok) throw new Error(`O site do fornecedor respondeu com erro ${res.status}.`);
  // Produto removido na Nuvemshop costuma redirecionar pra home/categoria.
  const destino = new URL(res.url);
  if (!destino.pathname.includes("/produtos/")) {
    throw new Error("O link redirecionou pra outra página — o produto pode ter sido removido do fornecedor.");
  }
  return res.text();
}

type Config = {
  reposicao: number;
  pausarEsgotado: boolean;
};

async function getConfigSync() {
  const c = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
  return {
    ativo: c?.syncFornecedorAtivo ?? false,
    dias: c?.syncFornecedorDias ?? [0, 1, 2, 3, 4, 5, 6],
    horarios: c?.syncFornecedorHorarios ?? ["08:00"],
    reposicao: c?.syncFornecedorEstoqueReposicao ?? 50,
    pausarEsgotado: c?.syncFornecedorPausarEsgotado ?? true,
    emailAlerta: c?.syncFornecedorEmailAlerta ?? null,
    ultimaExecucao: c?.syncFornecedorUltimaExecucao ?? null,
  };
}

export type ResultadoProduto = {
  produtoId: string;
  nome: string;
  categoria: string;
  ok: boolean;
  erro?: string;
  alterado: boolean;
  zeradas: string[];
  reativadas: string[];
};

async function sincronizarUm(produtoId: string, config: Config): Promise<ResultadoProduto> {
  const produto = await prisma.produto.findUniqueOrThrow({
    where: { id: produtoId },
    include: { variacoes: true, estoqueVariacoes: true, categoria: true },
  });
  const base = { produtoId, nome: produto.nome, categoria: produto.categoria.slug };
  const agora = new Date();

  try {
    const url = produto.fornecedorUrl && validarUrlFornecedor(produto.fornecedorUrl);
    if (!url) throw new Error("Link do fornecedor inválido.");
    const variantes = extrairVariantesNuvemshop(await baixarPagina(url));
    const r = calcularSync(
      {
        variacoes: produto.variacoes,
        estoque: produto.estoque,
        estoqueVariacoes: produto.estoqueVariacoes,
      },
      variantes,
      config.reposicao
    );

    const precoAtual = produto.fornecedorPreco != null ? Number(produto.fornecedorPreco) : null;
    const precoMudou = precoAtual != null && r.precoMinimo != null && precoAtual !== r.precoMinimo;

    let ativo: boolean | undefined;
    let pausou: boolean | undefined;
    if (config.pausarEsgotado && r.esgotadoTotal && produto.ativo) {
      ativo = false;
      pausou = true;
    } else if (!r.esgotadoTotal && produto.fornecedorPausouProduto) {
      ativo = true;
      pausou = false;
    }

    await prisma.$transaction(async (tx) => {
      if (r.grade) {
        await tx.estoqueVariacao.deleteMany({ where: { produtoId } });
        await tx.estoqueVariacao.createMany({
          data: r.grade.map((g) => ({ produtoId, combinacao: g.combinacao, estoque: g.estoque })),
        });
      }
      await tx.produto.update({
        where: { id: produtoId },
        data: {
          estoque: r.estoque,
          ativo,
          fornecedorPausouProduto: pausou,
          fornecedorVerificadoEm: agora,
          fornecedorErro: null,
          fornecedorAviso:
            r.semCorrespondencia.length > 0
              ? `Sem correspondente no fornecedor: ${r.semCorrespondencia.join(", ")}. Confira se os nomes batem.`
              : null,
          fornecedorPreco: r.precoMinimo ?? undefined,
          // Guarda o preço de antes da primeira mudança não vista — se mudar
          // de novo antes do "ciente", o alerta continua mostrando a origem.
          fornecedorPrecoAnterior:
            precoMudou && produto.fornecedorPrecoAnterior == null ? precoAtual : undefined,
        },
      });
    });

    return {
      ...base,
      ok: true,
      alterado: r.grade !== undefined || r.estoque !== undefined || ativo !== undefined,
      zeradas: r.zeradas,
      reativadas: r.reativadas,
    };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro desconhecido.";
    await prisma.produto.update({
      where: { id: produtoId },
      data: { fornecedorVerificadoEm: agora, fornecedorErro: erro },
    });
    return { ...base, ok: false, erro, alterado: false, zeradas: [], reativadas: [] };
  }
}

// Processa produtos com link que ainda não foram verificados desde `desde`,
// até estourar o orçamento de tempo. `pendentes` > 0 = chamar de novo.
export async function processarLote(desde: Date, orcamentoMs: number) {
  const inicio = Date.now();
  const config = await getConfigSync();
  const resultados: ResultadoProduto[] = [];
  const filtro = {
    fornecedorUrl: { not: null },
    OR: [{ fornecedorVerificadoEm: null }, { fornecedorVerificadoEm: { lt: desde } }],
  };

  while (Date.now() - inicio < orcamentoMs) {
    const lote = await prisma.produto.findMany({
      where: filtro,
      select: { id: true },
      orderBy: { fornecedorVerificadoEm: { sort: "asc", nulls: "first" } },
      take: PARALELO,
    });
    if (lote.length === 0) break;
    resultados.push(...(await Promise.all(lote.map((p) => sincronizarUm(p.id, config)))));
  }

  const pendentes = await prisma.produto.count({ where: filtro });
  return { resultados, pendentes };
}

export async function sincronizarProdutoAgora(produtoId: string) {
  const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);
  if (!produto.fornecedorUrl) throw new ErroDeNegocio("Este produto não tem link de fornecedor.");
  const config = await getConfigSync();
  return sincronizarUm(produtoId, config);
}

// Chamado pelo cron (de hora em hora). Só faz algo quando há um horário
// agendado mais novo que a última execução completa — o ciclo pode levar
// várias chamadas, e só é dado como completo quando não sobra pendente.
export async function executarCicloAgendado(agora = new Date(), orcamentoMs = 40_000) {
  const config = await getConfigSync();
  if (!config.ativo) return { executou: false, motivo: "Sincronização desligada.", pendentes: 0, resultados: [] };

  const horario = ultimoHorarioAgendado(agora, config.dias, config.horarios);
  if (!horario || (config.ultimaExecucao && config.ultimaExecucao >= horario)) {
    return { executou: false, motivo: "Nenhum horário agendado pendente.", pendentes: 0, resultados: [] };
  }

  const { resultados, pendentes } = await processarLote(horario, orcamentoMs);
  if (pendentes === 0) await concluirCiclo(horario, config.emailAlerta);
  return { executou: true, motivo: null, pendentes, resultados };
}

async function concluirCiclo(desde: Date, emailAlerta: string | null) {
  const produtos = await prisma.produto.findMany({
    where: { fornecedorUrl: { not: null }, fornecedorVerificadoEm: { gte: desde } },
    select: { id: true, nome: true, fornecedorUrl: true, fornecedorErro: true },
  });
  const comErro = produtos.filter((p) => p.fornecedorErro);
  await prisma.configuracaoLoja.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      syncFornecedorUltimaExecucao: new Date(),
      syncFornecedorResumo: { total: produtos.length, erros: comErro.length },
    },
    update: {
      syncFornecedorUltimaExecucao: new Date(),
      syncFornecedorResumo: { total: produtos.length, erros: comErro.length },
    },
  });
  if (emailAlerta && comErro.length > 0) {
    await enviarEmailAlertaFornecedor(
      emailAlerta,
      comErro.map((p) => ({ nome: p.nome, url: p.fornecedorUrl!, erro: p.fornecedorErro! }))
    );
  }
}

// --- Alertas do painel -------------------------------------------------------

export type AlertasFornecedor = {
  erros: { produtoId: string; nome: string; url: string; erro: string; em: string | null }[];
  avisos: { produtoId: string; nome: string; aviso: string }[];
  precos: { produtoId: string; nome: string; de: number; para: number }[];
};

export async function getAlertasFornecedor(): Promise<AlertasFornecedor> {
  const produtos = await prisma.produto.findMany({
    where: {
      fornecedorUrl: { not: null },
      OR: [
        { fornecedorErro: { not: null } },
        { fornecedorAviso: { not: null } },
        { fornecedorPrecoAnterior: { not: null } },
      ],
    },
    select: {
      id: true,
      nome: true,
      fornecedorUrl: true,
      fornecedorErro: true,
      fornecedorAviso: true,
      fornecedorVerificadoEm: true,
      fornecedorPreco: true,
      fornecedorPrecoAnterior: true,
    },
    orderBy: { nome: "asc" },
  });
  return {
    erros: produtos
      .filter((p) => p.fornecedorErro)
      .map((p) => ({
        produtoId: p.id,
        nome: p.nome,
        url: p.fornecedorUrl!,
        erro: p.fornecedorErro!,
        em: p.fornecedorVerificadoEm?.toISOString() ?? null,
      })),
    avisos: produtos
      .filter((p) => p.fornecedorAviso && !p.fornecedorErro)
      .map((p) => ({ produtoId: p.id, nome: p.nome, aviso: p.fornecedorAviso! })),
    precos: produtos
      .filter((p) => p.fornecedorPrecoAnterior != null && p.fornecedorPreco != null)
      .map((p) => ({
        produtoId: p.id,
        nome: p.nome,
        de: Number(p.fornecedorPrecoAnterior),
        para: Number(p.fornecedorPreco),
      })),
  };
}

export async function darCientePrecoFornecedor(produtoId: string) {
  await prisma.produto.updateMany({
    where: { id: produtoId },
    data: { fornecedorPrecoAnterior: null },
  });
}
