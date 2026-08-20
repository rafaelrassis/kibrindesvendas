import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { atualizarProduto, removerProduto } from "@/lib/data/produtos";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    const produto = await atualizarProduto(id, await corpoJson(req));
    revalidatePath("/");
    revalidatePath(`/produto/${id}`);
    revalidatePath(`/categoria/${produto.categoria}`);
    return NextResponse.json(produto);
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
    revalidatePath("/");
    revalidatePath(`/produto/${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
