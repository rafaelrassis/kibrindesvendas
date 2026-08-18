import { NextRequest, NextResponse } from "next/server";
import { atualizarConfiguracaoLoja, getConfiguracaoLoja } from "@/lib/data/configuracao";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getConfiguracaoLoja());
}

export async function PATCH(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    return NextResponse.json(await atualizarConfiguracaoLoja(await corpoJson(req)));
  } catch (e) {
    return respostaDeErro(e);
  }
}
