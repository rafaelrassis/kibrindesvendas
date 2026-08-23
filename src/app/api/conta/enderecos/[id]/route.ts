import { NextRequest, NextResponse } from "next/server";
import { atualizarEndereco, removerEndereco } from "@/lib/data/conta";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";
import type { Endereco } from "@/lib/conta-data";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const dados = await corpoJson<Omit<Endereco, "id">>(req);
    return NextResponse.json(await atualizarEndereco(usuarioId, id, dados));
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado." }, { status: 401 });
  }

  const { id } = await params;
  await removerEndereco(usuarioId, id);
  return NextResponse.json({ ok: true });
}
