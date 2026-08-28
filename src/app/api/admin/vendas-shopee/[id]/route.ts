import { NextRequest, NextResponse } from "next/server";
import { atualizarVendaShopee, excluirVendaShopee } from "@/lib/data/vendas-shopee";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    return NextResponse.json(await atualizarVendaShopee(id, await corpoJson(req)));
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { id } = await params;
  try {
    await excluirVendaShopee(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
