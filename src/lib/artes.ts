import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// As artes ficam fora de public/: em produção o Next indexa public/ quando
// sobe, então arquivo gravado depois disso só apareceria no próximo restart.
// Quem serve é GET /api/artes/[nome].
const PASTA_ARTES = path.join(process.cwd(), "var", "uploads", "artes");

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
  await mkdir(PASTA_ARTES, { recursive: true });
  await writeFile(path.join(PASTA_ARTES, nome), bytes);
  return { nome, url: `/api/artes/${nome}` };
}

// Só nomes que nós mesmos geramos passam — nada de subir diretório.
export function caminhoDaArte(nome: string) {
  if (!NOME_VALIDO.test(nome)) return null;
  return path.join(PASTA_ARTES, nome);
}

export function tipoDaArte(nome: string) {
  const extensao = nome.split(".").pop();
  return FORMATOS.find((f) => f.extensao === extensao)?.tipo ?? "application/octet-stream";
}
