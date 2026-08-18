import { NextRequest, NextResponse } from "next/server";
import { criarCupom, getCupons } from "@/lib/data/cupons";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getCupons());
}

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    return NextResponse.json(await criarCupom(await corpoJson(req)));
  } catch (e) {
    return respostaDeErro(e);
  }
}
