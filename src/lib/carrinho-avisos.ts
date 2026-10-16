// Avisos de uma linha do carrinho (estoque e preço) e a barra de frete grátis.
// Sem "server-only" nem React: roda no carrinho, no mini-carrinho e nos testes.
import { controladoPorVariacao, estoqueDaCombinacao, precoEfetivo } from "./estoque-variacao";
import type { Produto } from "./types";

// Estoque abaixo disso vira o aviso "restam só N".
export const LIMITE_ESTOQUE_BAIXO = 5;

// Teto de quantidade pra uma linha: estoque da combinação escolhida (produto
// com variação) ou estoque geral. null = não controlado (sem teto).
export function estoqueMaximoDaLinha(
  produto: Produto,
  variacoesEscolhidas: Record<string, string>
): number | null {
  if (controladoPorVariacao(produto)) {
    const completa = produto.variacoes.every((v) => variacoesEscolhidas[v.tipo]);
    return completa ? estoqueDaCombinacao(produto, variacoesEscolhidas) : null;
  }
  return produto.estoque;
}

export type AvisosLinha = {
  // Nada em estoque: a linha não pode ser comprada.
  esgotado: boolean;
  // Pediu mais do que há: quantidade disponível. null = não excede.
  excede: number | null;
  // Estoque baixo (mas suficiente pro pedido): unidades restantes. null = ok.
  estoqueBaixo: number | null;
  // Preço de hoje difere do que o cliente viu ao adicionar.
  precoMudou: { de: number; para: number } | null;
  // Linha impede finalizar a compra.
  bloqueia: boolean;
};

export function avisosDaLinha(
  produto: Produto,
  item: { variacoesEscolhidas: Record<string, string>; quantidade: number; precoAdicionado?: number }
): AvisosLinha {
  const estoque = estoqueMaximoDaLinha(produto, item.variacoesEscolhidas);
  const esgotado = estoque === 0;
  const excede = estoque != null && estoque > 0 && item.quantidade > estoque ? estoque : null;
  const estoqueBaixo =
    estoque != null && estoque > 0 && item.quantidade <= estoque && estoque <= LIMITE_ESTOQUE_BAIXO
      ? estoque
      : null;

  const atual = precoEfetivo(produto, item.variacoesEscolhidas);
  const precoMudou =
    item.precoAdicionado != null && Math.abs(atual - item.precoAdicionado) >= 0.01
      ? { de: item.precoAdicionado, para: atual }
      : null;

  return { esgotado, excede, estoqueBaixo, precoMudou, bloqueia: esgotado || excede !== null };
}

// Quanto falta pro frete grátis automático. null quando a loja não tem limiar
// ou o carrinho já passou dele (aí a tela mostra "frete grátis").
export function faltaParaFreteGratis(subtotal: number, limiar: number | null): number | null {
  if (limiar === null || subtotal >= limiar) return null;
  return Math.round((limiar - subtotal) * 100) / 100;
}
