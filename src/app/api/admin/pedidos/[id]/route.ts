import { NextRequest, NextResponse } from "next/server";
import { atualizarStatusPedido } from "@/lib/data/pedidos";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;

  try {
    const { status } = await corpoJson<{ status?: unknown }>(req);
    const pedido = await atualizarStatusPedido(id, status);
    return NextResponse.json({ id: pedido.id, status: pedido.status });
  } catch (e) {
    return respostaDeErro(e);
  }
}
