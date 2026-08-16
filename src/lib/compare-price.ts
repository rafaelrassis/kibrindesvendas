export interface ComparacaoPreco {
  mostrar: boolean;
  tipo?: "economia";
  percentual?: number;
  economia?: number;
}

export function compararPreco(precoShopee: number, precoKi: number): ComparacaoPreco {
  const economia = precoShopee - precoKi;

  if (economia <= 0) {
    return { mostrar: false };
  }

  const percentual = Math.round((economia / precoShopee) * 100);
  return { mostrar: true, tipo: "economia", percentual, economia };
}
