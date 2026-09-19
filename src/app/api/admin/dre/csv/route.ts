import { NextRequest, NextResponse } from "next/server";
import { bloqueioAdmin } from "@/lib/admin";
import { getDRE } from "@/lib/data/dre";
import { canalValido } from "@/lib/dre";

export async function GET(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { searchParams } = new URL(req.url);
  const { mes, canal, dre } = await getDRE(
    searchParams.get("mes") ?? undefined,
    canalValido(searchParams.get("canal") ?? undefined)
  );

  const v = (n: number) => n.toFixed(2).replace(".", ",");
  const linhas: [string, string][] = [
    ["Receita bruta", v(dre.receitaBruta)],
    ["Receita site (produtos)", v(dre.receitaSite)],
    ["Receita Shopee", v(dre.receitaShopee)],
    ["Frete cobrado", v(dre.freteCobrado)],
    ["(-) Cupons", v(-dre.cupons)],
    ["(-) Devolucoes", v(-dre.devolucoes)],
    ["Receita liquida", v(dre.receitaLiquida)],
    ["(-) Custo de material", v(-dre.custoMaterial)],
    ["Lucro bruto", v(dre.lucroBruto)],
    ["(-) Taxas Mercado Pago", v(-dre.taxasGateway)],
    ["(-) Taxas Shopee", v(-dre.taxasShopee)],
    ["(-) Frete pago (etiquetas)", v(-dre.fretePago)],
    ["(-) Despesas operacionais", v(-dre.despesas)],
    ["Resultado do periodo", v(dre.resultado)],
  ];
  // BOM + ";" pro Excel em pt-BR abrir com acento e coluna certos.
  const csv = "\uFEFF" + linhas.map(([a, b]) => `${a};${b}`).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dre-${mes}-${canal}.csv"`,
    },
  });
}
