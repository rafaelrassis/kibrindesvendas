import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { atualizarBanner, removerBanner } from "@/lib/data/banners";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    const banner = await atualizarBanner(id, await corpoJson(req));
    revalidatePath("/");
    return NextResponse.json(banner);
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    await removerBanner(id);
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
