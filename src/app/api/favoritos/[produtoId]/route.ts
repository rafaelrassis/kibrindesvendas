import { NextRequest, NextResponse } from "next/server";
import { desfavoritar } from "@/lib/data/favoritos";
import { usuarioIdDaSessao } from "@/lib/session";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ produtoId: string }> }
) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json(
      { error: "É preciso estar logado pra alterar favoritos." },
      { status: 401 }
    );
  }

  const { produtoId } = await params;
  await desfavoritar(usuarioId, produtoId);
  return NextResponse.json({ ok: true });
}
