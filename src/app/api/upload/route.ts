import { NextRequest, NextResponse } from "next/server";
import { usuarioIdDaSessao } from "@/lib/session";
import { formatoDoConteudo, salvarArte, TAMANHO_MAXIMO } from "@/lib/artes";

// Onde o arquivo é gravado (Vercel Blob em produção, disco em dev) é decisão
// de `src/lib/artes.ts`; aqui só valida sessão, tamanho e formato.
export async function POST(req: NextRequest) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json(
      { error: "É preciso estar logado pra enviar arquivos." },
      { status: 401 }
    );
  }

  // Corta antes de bufferizar o corpo inteiro.
  if (Number(req.headers.get("content-length") ?? 0) > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: "Arquivo maior que 15MB." }, { status: 413 });
  }

  const form = await req.formData();
  const arquivo = form.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: "Arquivo maior que 15MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const formato = formatoDoConteudo(bytes);
  if (!formato) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie PNG, JPG, WEBP ou PDF." },
      { status: 400 }
    );
  }

  try {
    const { url } = await salvarArte(bytes, formato.extensao);
    return NextResponse.json({ url, nome: arquivo.name });
  } catch (e) {
    // Sem isso, uma falha de gravação (ex: BLOB_READ_WRITE_TOKEN ausente ou
    // inválido em produção) vira página de erro HTML — o cliente tenta
    // interpretar como JSON e quebra sem mensagem nenhuma pra pessoa.
    console.error("Falha ao salvar arte:", e);
    return NextResponse.json(
      { error: "Não foi possível salvar o arquivo no servidor." },
      { status: 500 }
    );
  }
}
