import { NextRequest, NextResponse } from "next/server";
import { solicitarDevolucao } from "@/lib/data/pedidos";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { motivo } = await corpoJson<{ motivo?: string }>(req);
    return NextResponse.json(await solicitarDevolucao(usuarioId, id, motivo));
  } catch (e) {
    return respostaDeErro(e);
  }
}
