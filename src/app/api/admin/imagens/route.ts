import { NextRequest, NextResponse } from "next/server";
import { bloqueioAdmin } from "@/lib/admin";
import { formatoDeImagem, salvarImagem, TAMANHO_MAXIMO_IMAGEM } from "@/lib/imagens";

// Upload das imagens da loja (banner da home). Separado de /api/upload, que é
// a arte do cliente: lá qualquer sessão envia e o arquivo fica privado, aqui
// só admin envia e o que sobe vira URL aberta.
export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  // Corta antes de bufferizar o corpo inteiro.
  if (Number(req.headers.get("content-length") ?? 0) > TAMANHO_MAXIMO_IMAGEM) {
    return NextResponse.json({ error: "Imagem maior que 5MB." }, { status: 413 });
  }

  const form = await req.formData();
  const arquivo = form.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
    return NextResponse.json({ error: "Imagem maior que 5MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const formato = formatoDeImagem(bytes);
  if (!formato) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie PNG, JPG ou WEBP." },
      { status: 400 }
    );
  }

  const { url } = await salvarImagem(bytes, formato.extensao);
  return NextResponse.json({ url, nome: arquivo.name });
}
