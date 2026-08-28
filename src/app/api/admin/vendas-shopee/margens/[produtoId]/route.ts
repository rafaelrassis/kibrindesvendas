import { NextResponse } from "next/server";
import { margensShopeeDoProduto } from "@/lib/data/vendas-shopee";
import { bloqueioAdmin } from "@/lib/admin";
import { respostaDeErro } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ produtoId: string }> }
) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { produtoId } = await params;
  try {
    return NextResponse.json(await margensShopeeDoProduto(produtoId));
  } catch (e) {
    return respostaDeErro(e);
  }
}
