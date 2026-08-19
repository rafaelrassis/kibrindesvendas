import { NextRequest, NextResponse } from "next/server";
import { definirAprovacao, excluirAvaliacao } from "@/lib/data/avaliacoes";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;

  try {
    const { aprovado } = await corpoJson<{ aprovado?: unknown }>(req);
    await definirAprovacao(id, !!aprovado);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  await excluirAvaliacao(id);
  return NextResponse.json({ ok: true });
}
