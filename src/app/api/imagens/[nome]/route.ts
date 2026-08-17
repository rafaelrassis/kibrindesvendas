import { NextRequest, NextResponse } from "next/server";
import { lerImagem, nomeDeImagemValido, tipoDaImagem } from "@/lib/imagens";

// Imagem da loja é conteúdo público — o banner da home tem que abrir pra
// visitante deslogado. O nome é sorteado no upload e nunca muda, então o
// cache pode ser longo.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ nome: string }> }) {
  const { nome } = await params;
  if (!nomeDeImagemValido(nome)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const conteudo = await lerImagem(nome);
  if (!conteudo) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  return new NextResponse(conteudo, {
    headers: {
      "Content-Type": tipoDaImagem(nome),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
