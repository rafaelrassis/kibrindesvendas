// Sem "server-only": usado tanto no admin (montar a grade) quanto na página
// do produto (checar a combinação escolhida), então roda no cliente também.
import type { Produto } from "./types";

// Chave canônica de uma combinação de variações escolhidas — tipos
// ordenados alfabeticamente pra "Cor:Preta|Tamanho:G" dar sempre a mesma
// chave, não importa em que ordem o admin cadastrou os tipos ou o cliente
// escolheu na tela. É essa chave que fica salva em EstoqueVariacao.combinacao
// e em ItemPedido.variacaoEscolhida.
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
