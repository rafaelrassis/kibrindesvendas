import { NextRequest, NextResponse } from "next/server";
import { definirEnderecoPadrao } from "@/lib/data/conta";
import { usuarioIdDaSessao } from "@/lib/session";
import { respostaDeErro } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await definirEnderecoPadrao(usuarioId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
