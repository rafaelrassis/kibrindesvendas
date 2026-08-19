import { NextRequest, NextResponse } from "next/server";
import { atualizarCategoria, removerCategoria } from "@/lib/data/categorias";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { slug } = await params;

  try {
    const { label, imagemUrl } = await corpoJson<{ label?: string; imagemUrl?: string | null }>(
      req
    );
    if (!label?.trim()) {
      return NextResponse.json({ error: "Informe o nome da categoria." }, { status: 400 });
    }

    return NextResponse.json(await atualizarCategoria(slug, label, imagemUrl));
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
