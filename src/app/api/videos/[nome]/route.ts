import { NextRequest, NextResponse } from "next/server";
import { lerVideo, nomeDeVideoValido, tipoDoVideo } from "@/lib/video";

// Vídeo do produto é conteúdo público — tem que abrir pra visitante
// deslogado. Mesmo padrão de src/app/api/imagens/[nome]/route.ts.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ nome: string }> }) {
  const { nome } = await params;
  if (!nomeDeVideoValido(nome)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const conteudo = await lerVideo(nome);
  if (!conteudo) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  return new NextResponse(conteudo, {
    headers: {
      "Content-Type": tipoDoVideo(nome),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    },
  });
}
