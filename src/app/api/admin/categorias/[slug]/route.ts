import { NextRequest, NextResponse } from "next/server";
import { atualizarCategoria, removerCategoria } from "@/lib/data/categorias";
import { bloqueioAdmin, respostaDeErro } from "@/lib/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { slug } = await params;
  const { label, emoji } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Informe o nome da categoria." }, { status: 400 });
  }

  try {
    return NextResponse.json(await atualizarCategoria(slug, label, emoji));
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { slug } = await params;
  try {
    await removerCategoria(slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
