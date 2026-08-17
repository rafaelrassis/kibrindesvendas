import { NextRequest, NextResponse } from "next/server";
import { criarCategoria } from "@/lib/data/categorias";
import { bloqueioAdmin, respostaDeErro } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  const { label, emoji } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Informe o nome da categoria." }, { status: 400 });
  }

  try {
    return NextResponse.json(await criarCategoria(label, emoji));
  } catch (e) {
    return respostaDeErro(e);
  }
}
