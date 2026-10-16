import "server-only";
import { TransportadoraFrete, type ConfiguracaoLoja } from "@prisma/client";
import {
  calcularFrete,
  combinarFretesPorOrigem,
  cotarFreteMelhorEnvio,
  cotarFreteSuperFrete,
  normalizarCep,
  type OpcaoFrete,
  type PacoteFrete,
} from "@/lib/frete";
import { prisma } from "@/lib/prisma";
import { dimensaoEfetiva } from "@/lib/estoque-variacao";
import type { DimensaoValor } from "@/lib/types";
import { ErroDeNegocio } from "./erros";

export type EnderecoDeEntrega = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  // Todas as opções cotadas (mais de uma só quando a transportadora ativa
  // devolve várias, ex: SuperFrete com PAC e SEDEX). Ordenado do mais barato
  // pro mais caro.
  opcoesFrete: OpcaoFrete[];
  // A opção usada de fato no cálculo do total — a mais barata por padrão, ou
  // a que o cliente escolheu (ver `servicoEscolhido` em consultarCep).
  frete: OpcaoFrete;
};

// Uma linha do carrinho do ponto de vista do frete: só o que muda peso,
// dimensão e origem da postagem.
export type LinhaFrete = {
  produtoId: string;
  quantidade: number;
  variacoesEscolhidas?: Record<string, string>;
};

// Mesmo teto do carrinho (ver MAX_LINHAS_CARRINHO): a lista vem do navegador.
const MAX_LINHAS_FRETE = 30;

// O ViaCEP é público e sem credencial, mas é serviço de terceiro: cai, tem
// latência e às vezes devolve HTML. Timeout curto e erro traduzido pro cliente.
const TIMEOUT_MS = 5000;

type RespostaViaCep = {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

// Cota um grupo (todas as linhas que saem do mesmo CEP de origem) com a
// transportadora ativa. `null` quando falta token ou a API não respondeu —
// quem chama decide o que fazer (estimativa por região).
async function cotarGrupo(
  config: ConfiguracaoLoja,
  cepOrigem: string,
  cepDestino: string,
  pacote: PacoteFrete,
  quantidade: number
): Promise<OpcaoFrete[] | null> {
  if (config.transportadoraAtiva === TransportadoraFrete.SUPER_FRETE) {
    if (!config.superFreteToken) return null;
    const opcoes = await cotarFreteSuperFrete(
      config.superFreteToken,
      cepOrigem,
      cepDestino,
      pacote,
      quantidade,
      config.freteAchataFaixaPeso
    );
    return opcoes && opcoes.length > 0 ? opcoes : null;
  }

  // MELHOR_ENVIO — mantém o comportamento de sempre: só a mais barata.
  if (!config.melhorEnvioToken) return null;
  const cotacao = await cotarFreteMelhorEnvio(
    config.melhorEnvioToken,
    cepOrigem,
    cepDestino,
    pacote,
    quantidade
  );
  return cotacao ? [{ ...cotacao, servico: "Correios" }] : null;
}

// Linhas do mesmo grupo viram um pacote só pra cotação: se todas são a mesma
// embalagem (mesmo produto/variação em várias unidades), é 1 pacote × N
// unidades, como sempre foi. Se misturam produtos, vira uma caixa sintética:
// pesos somam, alturas empilham, largura e comprimento ficam no maior.
function pacoteDoGrupo(linhas: { pacote: PacoteFrete; quantidade: number }[]) {
  const [primeira] = linhas;
  const iguais = linhas.every(
    (l) =>
      l.pacote.pesoMiligramas === primeira.pacote.pesoMiligramas &&
      l.pacote.alturaMm === primeira.pacote.alturaMm &&
      l.pacote.larguraMm === primeira.pacote.larguraMm &&
      l.pacote.comprimentoMm === primeira.pacote.comprimentoMm
  );
  if (iguais) {
    return {
      pacote: primeira.pacote,
      quantidade: linhas.reduce((soma, l) => soma + l.quantidade, 0),
    };
  }
  return {
    pacote: {
      pesoMiligramas: linhas.reduce((s, l) => s + l.pacote.pesoMiligramas * l.quantidade, 0),
      alturaMm: linhas.reduce((s, l) => s + l.pacote.alturaMm * l.quantidade, 0),
      larguraMm: Math.max(...linhas.map((l) => l.pacote.larguraMm)),
      comprimentoMm: Math.max(...linhas.map((l) => l.pacote.comprimentoMm)),
    },
    quantidade: 1,
  };
}

// Cotação real (Correios, via Melhor Envio ou SuperFrete — o que estiver
// ativo em /admin/configuracoes) quando há produto e token configurado; cai
// pra estimativa por região quando falta um dos dois ou a API do agregador
// não responde. Nunca deixa o cliente sem número de frete.
//
// Carrinho com vários produtos: as linhas são agrupadas pelo CEP de origem
// (camiseta despachada de Franca-SP sai separada do resto, que sai do CEP da
// loja), cada grupo é cotado como um pacote e o frete final é a soma dos
// grupos — ver combinarFretesPorOrigem.
async function cotarOpcoesFrete(
  uf: string,
  cepDestino: string,
  linhas: LinhaFrete[]
): Promise<OpcaoFrete[]> {
  const estimativa = calcularFrete(uf);
  const soEstimativa: OpcaoFrete[] = [{ ...estimativa, servico: "Estimativa" }];
  if (linhas.length === 0) return soEstimativa;

  const ids = [...new Set(linhas.map((l) => l.produtoId))];
  const [config, produtosDb] = await Promise.all([
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } }),
    prisma.produto.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        pesoMiligramas: true,
        alturaMm: true,
        larguraMm: true,
        comprimentoMm: true,
        cepOrigemOverride: true,
        variacoes: { select: { tipo: true, afetaDimensao: true, dimensoesValores: true } },
      },
    }),
  ]);

  if (!config) return soEstimativa;

  const porOrigem = new Map<string, { pacote: PacoteFrete; quantidade: number }[]>();
  for (const linha of linhas) {
    const produtoDb = produtosDb.find((p) => p.id === linha.produtoId);
    if (!produtoDb) continue;

    // Variação escolhida (ex: tamanho de ímã) pode ter peso/dimensão próprios,
    // que substituem os do produto campo a campo — ver dimensaoEfetiva.
    const produto = dimensaoEfetiva(
      {
        ...produtoDb,
        variacoes: produtoDb.variacoes.map((v) => ({
          tipo: v.tipo,
          afetaDimensao: v.afetaDimensao,
          dimensoesValores: v.dimensoesValores as Record<string, DimensaoValor> | null,
        })),
      },
      linha.variacoesEscolhidas ?? {}
    );

    // Produto com fornecedor próprio (ex: camiseta despachada de Franca-SP)
    // cota a partir do CEP dele; os demais caem no CEP padrão da loja.
    const cepOrigemBruto = produto.cepOrigemOverride ?? config.cepOrigem;
    const cepOrigem = normalizarCep(cepOrigemBruto) ?? cepOrigemBruto;

    const grupo = porOrigem.get(cepOrigem) ?? [];
    grupo.push({
      pacote: {
        pesoMiligramas: produto.pesoMiligramas,
        alturaMm: produto.alturaMm,
        larguraMm: produto.larguraMm,
        comprimentoMm: produto.comprimentoMm,
      },
      quantidade: Math.max(1, Math.round(linha.quantidade) || 1),
    });
    porOrigem.set(cepOrigem, grupo);
  }

  if (porOrigem.size === 0) return soEstimativa;

  const cotacoes = await Promise.all(
    [...porOrigem.entries()].map(([cepOrigem, grupo]) => {
      const { pacote, quantidade } = pacoteDoGrupo(grupo);
      return cotarGrupo(config, cepOrigem, cepDestino, pacote, quantidade);
    })
  );

  return combinarFretesPorOrigem(cotacoes, estimativa);
}

// As linhas chegam do navegador (query string ou corpo): nada aqui é confiado.
// Lista malformada vira "sem linhas", que cai na estimativa por região.
export function lerLinhasFrete(bruto: unknown): LinhaFrete[] {
  let lista: unknown = bruto;
  if (typeof bruto === "string") {
    try {
      lista = JSON.parse(bruto);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(lista)) return [];

  const linhas: LinhaFrete[] = [];
  for (const entrada of lista.slice(0, MAX_LINHAS_FRETE)) {
    if (!entrada || typeof entrada !== "object") continue;
    const { produtoId, quantidade, variacoesEscolhidas, variacoes } = entrada as {
      produtoId?: unknown;
      quantidade?: unknown;
      variacoesEscolhidas?: unknown;
      variacoes?: unknown;
    };
    if (typeof produtoId !== "string" || !produtoId) continue;
    const qtd = Number(quantidade);
    const sel = variacoesEscolhidas ?? variacoes;
    linhas.push({
      produtoId,
      quantidade: Number.isFinite(qtd) && qtd > 0 ? Math.round(qtd) : 1,
      variacoesEscolhidas:
        sel && typeof sel === "object" ? (sel as Record<string, string>) : undefined,
    });
  }
  return linhas;
}

// Fonte da verdade do endereço e do frete: a tela do checkout consulta pra
// mostrar o valor, e o pedido consulta de novo na hora de gravar, pra não
// confiar no número que voltou do navegador.
// `cepBruto` é `unknown` porque chega do corpo da requisição: pedido sem CEP
// nenhum tem que virar 400, não 500 num `.replace` de undefined.
// Sem produto nem `itensBruto` (ex: cadastro de endereço avulso) cai direto na
// estimativa por região. `itensBruto` (carrinho inteiro) tem prioridade sobre
// os parâmetros de produto único.
export async function consultarCep(
  cepBruto: unknown,
  produtoIdBruto?: unknown,
  quantidadeBruta?: unknown,
  servicoEscolhidoBruto?: unknown,
  variacoesEscolhidasBruta?: unknown,
  itensBruto?: unknown
): Promise<EnderecoDeEntrega> {
  const cep = typeof cepBruto === "string" ? normalizarCep(cepBruto) : null;
  if (!cep) throw new ErroDeNegocio("CEP inválido: informe os 8 dígitos.");

  let linhas = lerLinhasFrete(itensBruto);
  if (linhas.length === 0 && typeof produtoIdBruto === "string" && produtoIdBruto) {
    const quantidadeNum = Number(quantidadeBruta);
    // Vem serializado em JSON na querystring (ex: {"Tamanho":"7x5"}) — corpo
    // malformado ou ausente cai em "sem variação", igual produto sem grade.
    let variacoesEscolhidas: Record<string, string> | undefined;
    if (typeof variacoesEscolhidasBruta === "string" && variacoesEscolhidasBruta) {
      try {
        const parsed = JSON.parse(variacoesEscolhidasBruta);
        if (parsed && typeof parsed === "object") variacoesEscolhidas = parsed;
      } catch {
        // ignora e segue sem override de dimensão
      }
    } else if (variacoesEscolhidasBruta && typeof variacoesEscolhidasBruta === "object") {
      variacoesEscolhidas = variacoesEscolhidasBruta as Record<string, string>;
    }
    linhas = [
      {
        produtoId: produtoIdBruto,
        quantidade:
          Number.isFinite(quantidadeNum) && quantidadeNum > 0 ? Math.round(quantidadeNum) : 1,
        variacoesEscolhidas,
      },
    ];
  }

  const servicoEscolhido =
    typeof servicoEscolhidoBruto === "string" ? servicoEscolhidoBruto : undefined;

  let resposta: Response;
  try {
    resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // O CEP muda muito pouco; cachear evita bater no ViaCEP a cada tecla.
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch {
    throw new ErroDeNegocio("Não foi possível consultar o CEP agora. Tente de novo.", 502);
  }

  if (!resposta.ok) {
    throw new ErroDeNegocio("Não foi possível consultar o CEP agora. Tente de novo.", 502);
  }

  const dados = (await resposta.json().catch(() => null)) as RespostaViaCep | null;

  // CEP inexistente volta 200 com `{ "erro": true }` — não dá pra olhar só o status.
  if (!dados || dados.erro || !dados.uf) {
    throw new ErroDeNegocio("CEP não encontrado.", 404);
  }

  const opcoesFrete = await cotarOpcoesFrete(dados.uf, cep, linhas);
  // Serviço escolhido pelo cliente no checkout (ex: "SEDEX"), se existir e
  // continuar entre as opções cotadas agora; senão, a mais barata (primeira
  // da lista, já vem ordenada).
  const frete =
    opcoesFrete.find((o) => o.servico === servicoEscolhido) ?? opcoesFrete[0];

  return {
    cep,
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    uf: dados.uf,
    opcoesFrete,
    frete,
  };
}

// Uma linha só, do jeito que o cliente e a loja leem depois no pedido.
export function resumoDoEndereco(endereco: EnderecoDeEntrega) {
  const rua = [endereco.logradouro, endereco.bairro].filter(Boolean).join(", ");
  return [rua, `${endereco.cidade}/${endereco.uf}`].filter(Boolean).join(" — ");
}

// Endereço salvo (ver model Endereco) + cotação de frete a partir dele — é o
// que o checkout usa depois que o cliente escolhe (ou cadastra) um endereço,
// em vez de digitar um CEP solto sem número nem destinatário.
export type EnderecoDeEntregaSalvo = EnderecoDeEntrega & {
  destinatario: string;
  numero: string;
  complemento: string;
  rua: string;
};

// Confia só no `enderecoId` + dono da sessão: nunca no CEP/número que o
// navegador tenha mandado solto, senão qualquer usuário logado poderia
// cotar (ou pior, gravar num pedido) o endereço de outra pessoa.
export async function consultarEnderecoSalvo(
  usuarioId: string,
  enderecoIdBruto: unknown,
  linhas: LinhaFrete[],
  servicoEscolhidoBruto?: unknown
): Promise<EnderecoDeEntregaSalvo> {
  const enderecoId = typeof enderecoIdBruto === "string" ? enderecoIdBruto : null;
  if (!enderecoId) throw new ErroDeNegocio("Escolha um endereço de entrega.");

  const salvo = await prisma.endereco.findFirst({ where: { id: enderecoId, usuarioId } });
  if (!salvo) throw new ErroDeNegocio("Endereço não encontrado.", 404);

  const cotacao = await consultarCep(
    salvo.cep,
    undefined,
    undefined,
    servicoEscolhidoBruto,
    undefined,
    linhas
  );

  return {
    ...cotacao,
    destinatario: salvo.destinatario,
    numero: salvo.numero,
    complemento: salvo.complemento ?? "",
    rua: salvo.rua,
  };
}

// Resumo completo pro pedido — a diferença do `resumoDoEndereco` de cima é
// que este vem do Endereco salvo (tem número e destinatário), não só do
// ViaCEP.
export function resumoDoEnderecoSalvo(endereco: EnderecoDeEntregaSalvo) {
  const rua = [`${endereco.rua}, ${endereco.numero}`, endereco.complemento, endereco.bairro]
    .filter(Boolean)
    .join(", ");
  return [rua, `${endereco.cidade}/${endereco.uf}`].filter(Boolean).join(" — ");
}
