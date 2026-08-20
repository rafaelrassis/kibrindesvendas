import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

    const categoria = await atualizarCategoria(slug, label, imagemUrl);
    // A home fica até 60s em cache (`revalidate = 60`) e as páginas de
    // categoria não são refeitas sozinhas — sem isso, trocar a foto aqui não
    // aparece em lugar nenhum até o cache vencer por conta própria.
    revalidatePath("/");
    revalidatePath("/categorias");
    revalidatePath(`/categoria/${slug}`);
    return NextResponse.json(categoria);
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
    revalidatePath("/");
    revalidatePath("/categorias");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
