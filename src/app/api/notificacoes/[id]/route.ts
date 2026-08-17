import { NextRequest, NextResponse } from "next/server";
import { marcarNotificacaoLida } from "@/lib/data/notificacoes";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { lida } = await corpoJson<{ lida?: boolean }>(req);
    await marcarNotificacaoLida(usuarioId, id, lida ?? true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
