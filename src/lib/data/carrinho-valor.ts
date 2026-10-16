import "server-only";
import { prisma } from "@/lib/prisma";
import { precoEfetivo } from "@/lib/estoque-variacao";
import { normalizarPrecosValores } from "./produtos";

export type LinhaValor = {
  produtoId: string;
  variacoesEscolhidas?: Record<string, string> | null;
  quantidade: number;
};

// Valor de produtos (sem frete) de uma lista de linhas, com o preço de hoje e
// a regra de preço por variação. Produto que sumiu do catálogo não conta.
// Usado onde o servidor precisa de um valor de referência sem montar pedido:
// painel de recuperação, lembretes e carrinho de visitante.
export async function valorDasLinhas(linhas: LinhaValor[]): Promise<number> {
  if (linhas.length === 0) return 0;
  const produtos = await prisma.produto.findMany({
    where: { id: { in: [...new Set(linhas.map((l) => l.produtoId))] } },
    include: { variacoes: true },
  });

  const total = linhas.reduce((soma, l) => {
    const p = produtos.find((x) => x.id === l.produtoId);
    if (!p) return soma;
    const unitario = precoEfetivo(
      {
        preco: Number(p.preco),
        variacoes: p.variacoes.map((v) => ({
          tipo: v.tipo,
          precosValores: normalizarPrecosValores(v.precosValores),
        })),
      },
      l.variacoesEscolhidas ?? {}
    );
    return soma + unitario * Math.max(1, l.quantidade);
  }, 0);
  return Math.round(total * 100) / 100;
}
