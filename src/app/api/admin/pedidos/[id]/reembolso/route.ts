import { NextRequest, NextResponse } from "next/server";
import { concederReembolsoSemDevolucao } from "@/lib/data/pedidos";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;

  try {
    const { valor, motivo } = await corpoJson<{ valor?: unknown; motivo?: unknown }>(req);
    const pedido = await concederReembolsoSemDevolucao(id, valor, motivo);
    return NextResponse.json({
      id: pedido.id,
      valorReembolsado: pedido.valorReembolsado ? Number(pedido.valorReembolsado) : null,
      motivoReembolso: pedido.motivoReembolso,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
