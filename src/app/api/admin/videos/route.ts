import { NextRequest, NextResponse } from "next/server";
import { bloqueioAdmin } from "@/lib/admin";
import { formatoDeVideo, salvarVideo, TAMANHO_MAXIMO_VIDEO } from "@/lib/video";

// Upload do vídeo do produto. Só admin envia; o que sobe vira URL aberta,
// igual à foto — ver src/app/api/admin/imagens/route.ts.
export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  if (Number(req.headers.get("content-length") ?? 0) > TAMANHO_MAXIMO_VIDEO) {
    return NextResponse.json({ error: "Vídeo maior que 30MB." }, { status: 413 });
  }

  const form = await req.formData();
  const arquivo = form.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO_VIDEO) {
    return NextResponse.json({ error: "Vídeo maior que 30MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const formato = formatoDeVideo(bytes);
  if (!formato) {
    return NextResponse.json({ error: "Formato não suportado. Envie MP4." }, { status: 400 });
  }

  const { url } = await salvarVideo(bytes, formato.extensao);
  return NextResponse.json({ url, nome: arquivo.name });
}
