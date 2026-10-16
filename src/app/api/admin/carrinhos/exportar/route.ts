import { NextRequest, NextResponse } from "next/server";
import { bloqueioAdmin } from "@/lib/admin";
import { respostaDeErro } from "@/lib/api";
import { exportarLembretesCsv } from "@/lib/data/carrinhos-export";

export async function GET(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const pedido = Number(req.nextUrl.searchParams.get("dias"));
    const dias = [7, 30, 90].includes(pedido) ? pedido : 30;
    const csv = await exportarLembretesCsv(dias);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lembretes-carrinho-${dias}d.csv"`,
      },
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
