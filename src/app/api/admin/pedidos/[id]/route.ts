import { NextRequest, NextResponse } from "next/server";
import { atualizarStatusPedido, definirCodigoRastreio, removerPedido } from "@/lib/data/pedidos";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;

  try {
    const { status, codigoRastreio } = await corpoJson<{
      status?: unknown;
      codigoRastreio?: unknown;
    }>(req);

    // Os dois campos são independentes na tela (status muda no select,
    // rastreio no campo ao lado), então a rota atende um de cada vez.
    if (status !== undefined) {
      const pedido = await atualizarStatusPedido(id, status);
      return NextResponse.json({ id: pedido.id, status: pedido.status });
    }
    if (codigoRastreio !== undefined) {
      const pedido = await definirCodigoRastreio(id, codigoRastreio);
      return NextResponse.json({ id: pedido.id, codigoRastreio: pedido.codigoRastreio });
    }
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    await removerPedido(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
