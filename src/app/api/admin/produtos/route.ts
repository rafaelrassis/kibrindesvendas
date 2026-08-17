import { NextRequest, NextResponse } from "next/server";
import { criarProduto } from "@/lib/data/produtos";
import { bloqueioAdmin, respostaDeErro } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    return NextResponse.json(await criarProduto(await req.json()));
  } catch (e) {
    return respostaDeErro(e);
  }
}
