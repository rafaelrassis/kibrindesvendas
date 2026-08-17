import { NextResponse } from "next/server";
import { getNotificacoes } from "@/lib/data/notificacoes";
import { usuarioIdDaSessao } from "@/lib/session";

export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return NextResponse.json(await getNotificacoes(usuarioId));
}
