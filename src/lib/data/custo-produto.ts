import { custoEfetivo } from "@/lib/estoque-variacao";

type Numerico = number | { toString(): string };

// Custo de material unitário de um produto numa seleção de variações. Lê
// Decimal/Json do Prisma e devolve número, pra o snapshot do pedido e o DRE
// usarem exatamente a mesma conta do painel.
export function custoUnitarioDoProduto(
  produto: {
    materiais: { quantidade: Numerico; custoUnitario: Numerico; variacaoValor: string | null }[];
    variacoes: { tipo: string; custosValores: unknown }[];
  },
  selecoes: Record<string, string>
): number {
  const valor = custoEfetivo(
    {
      materiais: produto.materiais.map((m) => ({
        quantidade: Number(m.quantidade),
        custoUnitario: Number(m.custoUnitario),
        variacaoValor: m.variacaoValor,
      })),
      variacoes: produto.variacoes.map((v) => ({
        tipo: v.tipo,
        custosValores: v.custosValores as Record<string, number> | null,
      })),
    },
    selecoes
  );
  return Math.round(valor * 100) / 100;
}
