import { NextRequest, NextResponse } from "next/server";
import { marcarNotificacaoLida } from "@/lib/data/notificacoes";
import { usuarioIdDaSessao } from "@/lib/session";
import { respostaDeErro } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const { lida } = await req.json();

  try {
    await marcarNotificacaoLida(usuarioId, id, lida ?? true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
