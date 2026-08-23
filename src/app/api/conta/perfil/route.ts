import { NextRequest, NextResponse } from "next/server";
import { atualizarPerfil, getPerfil } from "@/lib/data/conta";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) return NextResponse.json(null);

  try {
    return NextResponse.json(await getPerfil(usuarioId));
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
    const dados = await corpoJson<{
      nome?: string;
      telefone?: string;
      cpf?: string;
      aniversario?: string;
    }>(req);
    return NextResponse.json(await atualizarPerfil(usuarioId, dados));
  } catch (e) {
    return respostaDeErro(e);
  }
}
