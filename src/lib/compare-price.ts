export type ComparacaoPreco =
  | { mostrar: false }
  | { mostrar: true; tipo: "economia"; percentual: number; economia: number };

// Produto fora da Shopee não tem com o que comparar: o preço da Shopee pode
// ter sobrado de um cadastro antigo, então o comparativo some de vez.
export function compararPreco(
  precoShopee: number,
  precoKi: number,
  vendidoNaShopee: boolean
): ComparacaoPreco {
  if (!vendidoNaShopee) {
    return { mostrar: false };
  }

  const economia = precoShopee - precoKi;

  if (economia <= 0) {
    return { mostrar: false };
  }

  const percentual = Math.round((economia / precoShopee) * 100);
  return { mostrar: true, tipo: "economia", percentual, economia };
}

export type Desconto = { ativo: false } | { ativo: true; percentual: number };

// Desconto próprio da loja (precoOriginal riscado), independente da
// comparação com a Shopee acima. precoOriginal null/undefined ou <= preco
// não mostra nada — evita badge de desconto negativo por cadastro errado.
//
// `usaPrecoVariacao` cobre outro cadastro errado: precoOriginal é fixado pro
// preço base do produto, mas uma variação (ex: "Tamanho imã": 7x7 = R$1) pode
// ter preço próprio, bem mais barato, sem relação nenhuma com aquele
// "riscado". Sem essa flag, escolher um valor de variação barato faria
// aparecer um "-90% OFF" inventado — o preço nunca foi R$ daquele valor.
export function calcularDesconto(
  preco: number,
  precoOriginal: number | null | undefined,
  opts?: { usaPrecoVariacao?: boolean }
): Desconto {
  if (opts?.usaPrecoVariacao || !precoOriginal || precoOriginal <= preco) {
    return { ativo: false };
  }
  const percentual = Math.round(((precoOriginal - preco) / precoOriginal) * 100);
  return { ativo: true, percentual };
}

export function formatarPreco(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}
