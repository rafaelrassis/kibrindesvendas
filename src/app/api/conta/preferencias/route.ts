import { NextRequest, NextResponse } from "next/server";
import { atualizarPreferencias, getPreferencias } from "@/lib/data/conta";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { preferenciasPadrao, type Preferencias } from "@/lib/conta-data";

export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) return NextResponse.json(preferenciasPadrao);

  try {
    return NextResponse.json(await getPreferencias(usuarioId));
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function PUT(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado." }, { status: 401 });
  }

  try {
    const dados = await corpoJson<Preferencias>(req);
    return NextResponse.json(await atualizarPreferencias(usuarioId, dados));
  } catch (e) {
    return respostaDeErro(e);
  }
}
