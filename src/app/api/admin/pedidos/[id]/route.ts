import { NextRequest, NextResponse } from "next/server";
import { atualizarStatusPedido } from "@/lib/data/pedidos";
import { bloqueioAdmin, respostaDeErro } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  const { status } = await req.json();

  try {
    const pedido = await atualizarStatusPedido(id, status);
    return NextResponse.json({ id: pedido.id, status: pedido.status });
  } catch (e) {
    return respostaDeErro(e);
  }
}
