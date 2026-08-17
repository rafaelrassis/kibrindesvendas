import { NextRequest, NextResponse } from "next/server";
import { criarProduto } from "@/lib/data/produtos";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    return NextResponse.json(await criarProduto(await corpoJson(req)));
  } catch (e) {
    return respostaDeErro(e);
  }
}
