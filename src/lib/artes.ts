import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Onde a arte fica depende do ambiente:
//
// - Com BLOB_READ_WRITE_TOKEN (Vercel), vai pro Blob Store — o filesystem de
//   um deploy serverless é efêmero e não é compartilhado entre instâncias.
// - Sem o token (dev local), cai em var/uploads/. Fora de public/ de propósito:
//   o Next indexa public/ quando sobe, então arquivo gravado depois disso só
//   apareceria no próximo restart.
//
// Nos dois casos quem serve é GET /api/artes/[nome], que exige sessão: arte de
// cliente não fica em URL pública. Por isso o blob também é `access: "private"`.
const PASTA_ARTES = path.join(process.cwd(), "var", "uploads", "artes");
const PREFIXO_BLOB = "artes";

function usaBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export const TAMANHO_MAXIMO = 15 * 1024 * 1024; // 15MB

// A extensão sai da assinatura do arquivo, nunca do nome que o navegador
// mandou: é ela que decide o Content-Type na hora de servir de volta.
const FORMATOS = [
  { extensao: "png", tipo: "image/png", assinatura: [0x89, 0x50, 0x4e, 0x47] },
  { extensao: "jpg", tipo: "image/jpeg", assinatura: [0xff, 0xd8, 0xff] },
  { extensao: "pdf", tipo: "application/pdf", assinatura: [0x25, 0x50, 0x44, 0x46] },
  // WEBP é "RIFF" + 4 bytes de tamanho + "WEBP", daí a segunda checagem.
  {
    extensao: "webp",
    tipo: "image/webp",
    assinatura: [0x52, 0x49, 0x46, 0x46],
    assinatura2: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  },
] as const;

const NOME_VALIDO = new RegExp(
  `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${FORMATOS.map(
    (f) => f.extensao
  ).join("|")})$`
);

function combina(bytes: Buffer, assinatura: readonly number[], offset = 0) {
  return assinatura.every((b, i) => bytes[offset + i] === b);
}

// O `type` do FormData é o que o cliente diz que enviou. Conferimos o conteúdo
// pra um arquivo não entrar como imagem sendo outra coisa.
export function formatoDoConteudo(bytes: Buffer) {
  return FORMATOS.find(
    (f) =>
      combina(bytes, f.assinatura) &&
      (!("assinatura2" in f) || combina(bytes, f.assinatura2.bytes, f.assinatura2.offset))
  );
}

export async function salvarArte(bytes: Buffer, extensao: string) {
  const nome = `${randomUUID()}.${extensao}`;

  if (usaBlob()) {
    const { put } = await import("@vercel/blob");
    await put(`${PREFIXO_BLOB}/${nome}`, bytes, {
      access: "private",
      contentType: tipoDaArte(nome),
    });
  } else {
    await mkdir(PASTA_ARTES, { recursive: true });
    await writeFile(path.join(PASTA_ARTES, nome), bytes);
  }

  return { nome, url: `/api/artes/${nome}` };
}

// Só nomes que nós mesmos geramos passam — nada de subir diretório.
export function nomeDeArteValido(nome: string) {
  return NOME_VALIDO.test(nome);
}

// Devolve o conteúdo pra /api/artes/[nome] servir, ou null se não existe.
export async function lerArte(
  nome: string
): Promise<Uint8Array<ArrayBuffer> | ReadableStream<Uint8Array> | null> {
  if (!nomeDeArteValido(nome)) return null;

  if (usaBlob()) {
    const { get } = await import("@vercel/blob");
    const resultado = await get(`${PREFIXO_BLOB}/${nome}`, { access: "private" });
    return resultado?.stream ?? null;
  }

  try {
    return new Uint8Array(await readFile(path.join(PASTA_ARTES, nome)));
  } catch {
    return null;
  }
}

export function tipoDaArte(nome: string) {
  const extensao = nome.split(".").pop();
  return FORMATOS.find((f) => f.extensao === extensao)?.tipo ?? "application/octet-stream";
}
