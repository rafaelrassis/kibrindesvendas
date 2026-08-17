import { NextRequest, NextResponse } from "next/server";
import { getPedidoDoUsuario, paraPedidoPublico } from "@/lib/data/pedidos";
import { usuarioIdDaSessao } from "@/lib/session";

// Serve a tela de detalhe do pedido e a confirmação, que consulta daqui
// enquanto o pagamento não é confirmado pelo Mercado Pago (Pix leva segundos,
// boleto pode levar dias).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const pedido = await getPedidoDoUsuario(usuarioId, id);
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  return NextResponse.json(paraPedidoPublico(pedido));
}
