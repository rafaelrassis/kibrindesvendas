import { NextRequest, NextResponse } from "next/server";
import { criarDespesa } from "@/lib/data/despesas";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const despesa = await criarDespesa(await corpoJson(req));
    return NextResponse.json({ id: despesa.id }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e);
  }
}
