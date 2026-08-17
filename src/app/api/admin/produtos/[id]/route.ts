import { NextRequest, NextResponse } from "next/server";
import { atualizarProduto, removerProduto } from "@/lib/data/produtos";
import { bloqueioAdmin, respostaDeErro } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    return NextResponse.json(await atualizarProduto(id, await req.json()));
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    await removerProduto(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
