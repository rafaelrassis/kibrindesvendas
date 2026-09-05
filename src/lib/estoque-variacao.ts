// Sem "server-only": usado tanto no admin (montar a grade) quanto na página
// do produto (checar a combinação escolhida), então roda no cliente também.
import type { DimensaoValor, Produto } from "./types";

// Chave canônica de uma combinação de variações escolhidas — tipos
// ordenados alfabeticamente pra "Cor:Preta|Tamanho:G" dar sempre a mesma
// chave, não importa em que ordem o admin cadastrou os tipos ou o cliente
// escolheu na tela. É essa chave que fica salva em EstoqueVariacao.combinacao
// e em ItemPedido.variacaoEscolhida.
// Tipos de variação que suportam foto por valor (upload no admin + troca de
// galeria na página do produto), igual já funcionava só pra "Cor".
const TIPOS_COM_FOTO_POR_VALOR = ["cor", "tamanho imã", "tamanho ima"];

export function tipoTemFotoPorValor(tipo: string): boolean {
  return TIPOS_COM_FOTO_POR_VALOR.includes(tipo.trim().toLowerCase());
}

// Preço final do produto pra uma seleção de variações: percorre as
// variações na ordem cadastrada e usa o preço do primeiro valor escolhido
// que tenha entrada em precosValores (substitui, não soma). Sem nenhuma
// entrada aplicável, cai no preço normal do produto.
export function precoEfetivo(
  produto: { preco: number; variacoes: { tipo: string; precosValores?: Record<string, number> | null }[] },
  selecoes: Record<string, string>
): number {
  for (const v of produto.variacoes) {
    const valor = selecoes[v.tipo];
    if (valor == null) continue;
    const preco = v.precosValores?.[valor];
    if (preco != null) return preco;
  }
  return produto.preco;
}

// Custo de material pra uma seleção de variações: mesmo algoritmo de
// precoEfetivo, mas pra custosValores. Sem entrada aplicável, cai no
// custoTotal normal do produto (soma de MaterialProduto). Uso restrito ao
// admin — nunca chamado com dado vindo da API pública.
export function custoEfetivo(
  produto: { custoTotal: number; variacoes: { tipo: string; custosValores?: Record<string, number> | null }[] },
  selecoes: Record<string, string>
): number {
  for (const v of produto.variacoes) {
    const valor = selecoes[v.tipo];
    if (valor == null) continue;
    const custo = v.custosValores?.[valor];
    if (custo != null) return custo;
  }
  return produto.custoTotal;
}

// Peso/dimensões pra uma seleção de variações: percorre as variações na
// ordem cadastrada e usa a primeira entrada aplicável em dimensoesValores —
// mas campo a campo, não tudo-ou-nada: um valor com só pesoMiligramas
// cadastrado herda altura/largura/comprimento do produto normalmente. Sem
// nenhuma entrada aplicável, cai nas dimensões normais do produto (mesmo
// comportamento de sempre, produto sem essa config).
export function dimensaoEfetiva<
  T extends { pesoMiligramas: number; alturaMm: number; larguraMm: number; comprimentoMm: number }
>(
  produto: T & { variacoes: { tipo: string; dimensoesValores?: Record<string, DimensaoValor> | null }[] },
  selecoes: Record<string, string>
): T {
  let override: DimensaoValor | undefined;
  for (const v of produto.variacoes) {
    const valor = selecoes[v.tipo];
    if (valor == null) continue;
    const dim = v.dimensoesValores?.[valor];
    if (dim != null) {
      override = dim;
      break;
    }
  }
  if (!override) return produto;
  return {
    ...produto,
    pesoMiligramas: override.pesoMiligramas ?? produto.pesoMiligramas,
    alturaMm: override.alturaMm ?? produto.alturaMm,
    larguraMm: override.larguraMm ?? produto.larguraMm,
    comprimentoMm: override.comprimentoMm ?? produto.comprimentoMm,
  };
}

export function buildCombinacaoKey(escolhas: Record<string, string>): string {
  return Object.keys(escolhas)
    .sort()
    .map((tipo) => `${tipo}:${escolhas[tipo]}`)
    .join("|");
}

// Todas as combinações possíveis a partir da lista de variações do produto
// (produto cartesiano). Ex: Tamanho[P,M] × Cor[Branca,Preta] → 4 combinações.
// Usado pelo admin pra desenhar a grade inteira, sempre que há variação.
export function gerarCombinacoes(
  variacoes: { tipo: string; valores: string[] }[]
): Record<string, string>[] {
  return variacoes.reduce<Record<string, string>[]>(
    (acc, v) => {
      if (v.valores.length === 0) return acc;
      return acc.flatMap((base) => v.valores.map((valor) => ({ ...base, [v.tipo]: valor })));
    },
    [{}]
  );
}

// Um produto usa controle por combinação quando tem ao menos uma linha em
// estoqueVariacoes — presença das linhas é o próprio "ligado/desligado"
// (não existe flag separada). Produto sem variações nunca cai aqui, usa só
// `estoque`.
export function controladoPorVariacao(produto: Pick<Produto, "estoqueVariacoes">): boolean {
  return produto.estoqueVariacoes.length > 0;
}

// Estoque da combinação escolhida. Combinação sem linha cadastrada conta
// como esgotada (0) — mesmo critério usado no checkout (ver criarPedido).
export function estoqueDaCombinacao(
  produto: Pick<Produto, "estoqueVariacoes">,
  escolhas: Record<string, string>
): number {
  const chave = buildCombinacaoKey(escolhas);
  const linha = produto.estoqueVariacoes.find((e) => e.combinacao === chave);
  return linha?.estoque ?? 0;
}

// Esgotado pra fins de badge/listagem: soma todas as combinações quando
// controlado por variação, senão olha o campo único de sempre.
export function produtoEsgotado(
  produto: Pick<Produto, "estoque" | "estoqueVariacoes">
): boolean {
  if (controladoPorVariacao(produto)) {
    return produto.estoqueVariacoes.every((e) => e.estoque === 0);
  }
  return produto.estoque === 0;
}
