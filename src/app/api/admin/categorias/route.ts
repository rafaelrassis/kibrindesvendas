import { NextRequest, NextResponse } from "next/server";
import { criarCategoria } from "@/lib/data/categorias";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const { label, imagemUrl } = await corpoJson<{ label?: string; imagemUrl?: string | null }>(
      req
    );
    if (!label?.trim()) {
      return NextResponse.json({ error: "Informe o nome da categoria." }, { status: 400 });
    }

    return NextResponse.json(await criarCategoria(label, imagemUrl));
  } catch (e) {
    return respostaDeErro(e);
  }
}
