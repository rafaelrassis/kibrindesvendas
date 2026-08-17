import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Base compartilhada por quem grava arquivo enviado pelo navegador: arte do
// cliente (src/lib/artes.ts, privada) e imagem da loja (src/lib/imagens.ts,
// aberta). O que muda entre as duas é só o depósito e a lista de formatos —
// a validação por assinatura e a escolha entre Blob e disco são as mesmas.

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

export type Extensao = (typeof FORMATOS)[number]["extensao"];

// Onde o arquivo é gravado depende do ambiente:
//
// - Com BLOB_READ_WRITE_TOKEN (Vercel), vai pro Blob Store — o filesystem de
//   um deploy serverless é efêmero e não é compartilhado entre instâncias.
// - Sem o token (dev local), cai em var/uploads/. Fora de public/ de propósito:
//   o Next indexa public/ quando sobe, então arquivo gravado depois disso só
//   apareceria no próximo restart.
//
// Nos dois casos o blob é `access: "private"` e quem serve é uma rota nossa —
// é ela, não o storage, que decide se o arquivo pede sessão.
export type Deposito = "artes" | "imagens";

const PASTA_ARTES = path.join(process.cwd(), "var", "uploads", "artes");
const PASTA_IMAGENS = path.join(process.cwd(), "var", "uploads", "imagens");

// O `if` parece rebuscado perto de montar o caminho a partir do parâmetro, mas
// é ele que mantém as duas pastas visíveis pro bundler: caminho vindo de
// variável faz o rastreio de arquivos abrir mão do recorte e empacotar o
// projeto inteiro junto com o servidor.
function caminho(onde: Deposito, nome: string) {
  return onde === "artes" ? path.join(PASTA_ARTES, nome) : path.join(PASTA_IMAGENS, nome);
}

function pasta(onde: Deposito) {
  return onde === "artes" ? PASTA_ARTES : PASTA_IMAGENS;
}

function usaBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function combina(bytes: Buffer, assinatura: readonly number[], offset = 0) {
  return assinatura.every((b, i) => bytes[offset + i] === b);
}

// O `type` do FormData é o que o cliente diz que enviou. Conferimos o conteúdo
// pra um arquivo não entrar como imagem sendo outra coisa.
export function formatoDoConteudo(bytes: Buffer, aceitos?: readonly Extensao[]) {
  return FORMATOS.find(
    (f) =>
      (!aceitos || aceitos.includes(f.extensao)) &&
      combina(bytes, f.assinatura) &&
      (!("assinatura2" in f) || combina(bytes, f.assinatura2.bytes, f.assinatura2.offset))
  );
}

// Só nomes que nós mesmos geramos passam — nada de subir diretório.
export function nomeValido(nome: string, aceitos?: readonly Extensao[]) {
  const extensoes = (aceitos ?? FORMATOS.map((f) => f.extensao)).join("|");
  return new RegExp(
    `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${extensoes})$`
  ).test(nome);
}

export function tipoPeloNome(nome: string) {
  const extensao = nome.split(".").pop();
  return FORMATOS.find((f) => f.extensao === extensao)?.tipo ?? "application/octet-stream";
}

export async function salvarArquivo(bytes: Buffer, extensao: string, onde: Deposito) {
  const nome = `${randomUUID()}.${extensao}`;

  if (usaBlob()) {
    const { put } = await import("@vercel/blob");
    await put(`${onde}/${nome}`, bytes, {
      access: "private",
      contentType: tipoPeloNome(nome),
    });
  } else {
    await mkdir(pasta(onde), { recursive: true });
    await writeFile(caminho(onde, nome), bytes);
  }

  return { nome };
}

// Devolve o conteúdo pra rota servir, ou null se não existe.
export async function lerArquivo(
  nome: string,
  onde: Deposito
): Promise<Uint8Array<ArrayBuffer> | ReadableStream<Uint8Array> | null> {
  if (usaBlob()) {
    const { get } = await import("@vercel/blob");
    const resultado = await get(`${onde}/${nome}`, { access: "private" });
    return resultado?.stream ?? null;
  }

  try {
    return new Uint8Array(await readFile(caminho(onde, nome)));
  } catch {
    return null;
  }
}
