import { NextRequest, NextResponse } from "next/server";
import { atualizarBanner, removerBanner } from "@/lib/data/banners";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    return NextResponse.json(await atualizarBanner(id, await corpoJson(req)));
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
