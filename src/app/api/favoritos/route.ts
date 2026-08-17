import { NextRequest, NextResponse } from "next/server";
import { favoritar, getFavoritos } from "@/lib/data/favoritos";
import { usuarioIdDaSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";

// Visitante sem conta não tem favoritos guardados: lista vazia, sem erro — quem
// convida a entrar é a tela.
export async function GET() {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) return NextResponse.json([]);

  return NextResponse.json(await getFavoritos(usuarioId));
}

export async function POST(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json(
      { error: "É preciso estar logado pra salvar favoritos." },
      { status: 401 }
    );
  }

  try {
    const { produtoId } = await corpoJson<{ produtoId?: string }>(req);
    if (!produtoId) {
      return NextResponse.json({ error: "Informe o produto." }, { status: 400 });
    }

    await favoritar(usuarioId, produtoId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
