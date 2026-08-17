import { NextResponse } from "next/server";
import { getNotificacoes } from "@/lib/data/notificacoes";
import { usuarioIdDaSessao } from "@/lib/session";

export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) return NextResponse.json([]);

  return NextResponse.json(await getNotificacoes(usuarioId));
}
