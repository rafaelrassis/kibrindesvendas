import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarEmailAlertaFornecedor } from "@/lib/email";
import {
  calcularSync,
  espelharVariacoes,
  extrairImagemPrincipal,
  extrairVariantesNuvemshop,
  normalizarOpcao,
  ultimoHorarioAgendado,
  validarUrlFornecedor,
} from "@/lib/fornecedor";
import { tipoTemFotoPorValor } from "@/lib/estoque-variacao";
import { formatoDeImagem, salvarImagem } from "@/lib/imagens";
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

export async function baixarPagina(url: string): Promise<string> {
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
  // Valores de variação criados/apagados pelo espelhamento.
  criadas?: string[];
  apagadas?: string[];
};

// Json de "valor => dado" sem as chaves apagadas (Prisma pede JsonNull pra
// limpar a coluna, e null/undefined pra deixar como está).
function semChaves(json: Prisma.JsonValue | null, apagar: Set<string>) {
  if (!json || typeof json !== "object" || Array.isArray(json) || apagar.size === 0) return undefined;
  const restante = Object.fromEntries(Object.entries(json).filter(([k]) => !apagar.has(k)));
  return restante as Prisma.InputJsonObject;
}

const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;
const MAX_FOTOS_POR_CICLO = 25;

// Baixa uma foto do CDN do fornecedor e guarda no depósito da loja. Devolve a
// URL daqui, ou null se não deu (fora do ar, grande demais, não é imagem).
async function trazerFoto(urlFornecedor: string): Promise<string | null> {
  try {
    const res = await fetch(urlFornecedor, {
      signal: AbortSignal.timeout(TIMEOUT_FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > TAMANHO_MAXIMO_FOTO) return null;
    const formato = formatoDeImagem(bytes);
    if (!formato) return null;
    return (await salvarImagem(bytes, formato.extensao)).url;
  } catch {
    return null;
  }
}

type ProdutoComVariacoes = Awaited<ReturnType<typeof carregarProduto>>;
async function carregarProduto(produtoId: string) {
  return prisma.produto.findUniqueOrThrow({
    where: { id: produtoId },
    include: { variacoes: true, estoqueVariacoes: true, categoria: true },
  });
}

// Fotos que faltam: uma por valor de cor (variação com foto por valor) sem
// foto cadastrada e, se a galeria do produto está vazia, a foto principal.
// Nunca troca foto que já existe. null = nada a trazer.
async function trazerFotos(
  produto: ProdutoComVariacoes,
  espelho: ReturnType<typeof espelharVariacoes>,
  variantes: ReturnType<typeof extrairVariantesNuvemshop>,
  html: string
) {
  let restante = MAX_FOTOS_POR_CICLO;
  const porVariacao = new Map<number, Record<string, string[]>>();
  for (const v of espelho.variacoes) {
    if (!tipoTemFotoPorValor(v.tipo)) continue;
    const existentes = (
      v.indice !== null ? produto.variacoes[v.indice].imagensValores : null
    ) as Record<string, string[]> | null;
    const novas: Record<string, string[]> = {};
    for (const valor of v.valores) {
      if (restante <= 0) break;
      if ((existentes?.[valor] ?? []).length > 0) continue;
      const alvo = normalizarOpcao(valor);
      const url = variantes.find(
        (x) => x.imagem && normalizarOpcao(x.opcoes[v.coluna] ?? "") === alvo
      )?.imagem;
      if (!url) continue;
      restante--;
      const nossa = await trazerFoto(url);
      if (nossa) novas[valor] = [nossa];
    }
    if (Object.keys(novas).length > 0) porVariacao.set(v.coluna, novas);
  }

  let galeria: string[] | undefined;
  if (produto.imagens.length === 0 && restante > 0) {
    const principal = extrairImagemPrincipal(html);
    const nossa = principal ? await trazerFoto(principal) : null;
    if (nossa) galeria = [nossa];
  }

  return porVariacao.size > 0 || galeria ? { porVariacao, galeria } : null;
}

function comFotos(
  atual: unknown,
  novas: Record<string, string[]> | undefined
) {
  if (!novas) return atual == null ? undefined : (atual as Prisma.InputJsonObject);
  const base = atual && typeof atual === "object" && !Array.isArray(atual) ? atual : {};
  return { ...base, ...novas } as Prisma.InputJsonObject;
}

async function sincronizarUm(produtoId: string, config: Config): Promise<ResultadoProduto> {
  const produto = await carregarProduto(produtoId);
  const base = { produtoId, nome: produto.nome, categoria: produto.categoria.slug };
  const agora = new Date();

  try {
    const url = produto.fornecedorUrl && validarUrlFornecedor(produto.fornecedorUrl);
    if (!url) throw new Error("Link do fornecedor inválido.");
    const html = await baixarPagina(url);
    const variantes = extrairVariantesNuvemshop(html);
    const espelho = produto.fornecedorEspelhar
      ? espelharVariacoes(produto.variacoes, variantes)
      : null;
    // Fotos que faltam aqui (cor sem foto, galeria vazia) vêm do fornecedor.
    const fotos = espelho ? await trazerFotos(produto, espelho, variantes, html) : null;
    const espelhar = espelho && (espelho.mudou || fotos) ? espelho : null;
    // Variações como ficam depois do espelho (a grade de estoque é calculada
    // em cima delas).
    const variacoesFinais = espelhar
      ? espelhar.variacoes
      : produto.variacoes.map((v) => ({ tipo: v.tipo, valores: v.valores }));
    const r = calcularSync(
      {
        variacoes: variacoesFinais,
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
      if (espelhar) {
        for (const nova of espelhar.variacoes) {
          if (nova.indice === null) {
            await tx.variacao.create({
              data: {
                produtoId,
                tipo: nova.tipo,
                valores: nova.valores,
                imagensValores: comFotos(null, fotos?.porVariacao.get(nova.coluna)),
              },
            });
            continue;
          }
          const atual = produto.variacoes[nova.indice];
          const apagados = new Set(
            espelhar.removidos.filter((x) => x.indice === nova.indice).map((x) => x.valor)
          );
          await tx.variacao.update({
            where: { id: atual.id },
            data: {
              valores: nova.valores,
              imagensValores: comFotos(
                semChaves(atual.imagensValores, apagados) ?? atual.imagensValores,
                fotos?.porVariacao.get(nova.coluna)
              ),
              precosValores: semChaves(atual.precosValores, apagados),
              custosValores: semChaves(atual.custosValores, apagados),
              dimensoesValores: semChaves(atual.dimensoesValores, apagados),
            },
          });
        }
      }
      if (r.grade) {
        await tx.estoqueVariacao.deleteMany({ where: { produtoId } });
        await tx.estoqueVariacao.createMany({
          data: r.grade.map((g) => ({ produtoId, combinacao: g.combinacao, estoque: g.estoque })),
        });
      }
      await tx.produto.update({
        where: { id: produtoId },
        data: {
          imagens: fotos?.galeria,
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
      alterado: espelhar !== null || fotos !== null || r.grade !== undefined || r.estoque !== undefined || ativo !== undefined,
      zeradas: r.zeradas,
      reativadas: r.reativadas,
      criadas: espelhar?.adicionados,
      apagadas: espelhar?.removidos.map((x) => x.valor),
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
  // Sync ligada mas o ciclo do horário agendado não terminou (cron parado,
  // CRON_SECRET errado, função caindo por tempo...). null = em dia.
  atraso: { horario: string; ultimaExecucao: string | null } | null;
};

// Tolerância antes de acusar atraso: o GitHub Actions bate de hora em hora e
// um ciclo grande pode levar mais de uma chamada pra terminar.
const TOLERANCIA_ATRASO_MS = 3 * 60 * 60 * 1000;

export async function getAlertasFornecedor(): Promise<AlertasFornecedor> {
  const config = await getConfigSync();
  // Sincronização desligada: nada a cobrar, o painel fica limpo.
  if (!config.ativo) return { erros: [], avisos: [], precos: [], atraso: null };

  const horario = ultimoHorarioAgendado(new Date(), config.dias, config.horarios);
  const atrasado =
    horario !== null &&
    Date.now() - horario.getTime() > TOLERANCIA_ATRASO_MS &&
    (!config.ultimaExecucao || config.ultimaExecucao < horario);
  const atraso = atrasado
    ? { horario: horario.toISOString(), ultimaExecucao: config.ultimaExecucao?.toISOString() ?? null }
    : null;

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
    atraso,
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
