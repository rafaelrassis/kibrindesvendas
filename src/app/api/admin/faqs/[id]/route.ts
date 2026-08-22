import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { atualizarFaq, removerFaq } from "@/lib/data/faq";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    const faq = await atualizarFaq(id, await corpoJson(req));
    revalidatePath("/suporte");
    return NextResponse.json(faq);
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    await removerFaq(id);
    revalidatePath("/suporte");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
