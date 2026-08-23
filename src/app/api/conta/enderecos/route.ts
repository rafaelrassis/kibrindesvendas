import { NextRequest, NextResponse } from "next/server";
import { criarEndereco, getEnderecos } from "@/lib/data/conta";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";
import type { Endereco } from "@/lib/conta-data";

export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) return NextResponse.json([]);

  return NextResponse.json(await getEnderecos(usuarioId));
}

export async function POST(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "É preciso estar logado." }, { status: 401 });
  }

  try {
    const dados = await corpoJson<Omit<Endereco, "id">>(req);
    const criado = await criarEndereco(usuarioId, dados);
    return NextResponse.json(criado, { status: 201 });
  } catch (e) {
    return respostaDeErro(e);
  }
}
