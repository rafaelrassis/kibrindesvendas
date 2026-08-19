import "server-only";
import {
  formatoDoConteudo as formatoDoConteudoDeArquivo,
  lerArquivo,
  nomeValido,
  salvarArquivo,
  tipoPeloNome,
  type Extensao,
} from "@/lib/arquivos";

// Arte enviada pelo cliente. Fica em `artes/` (Vercel Blob) ou
// `var/uploads/artes/` (dev) — ver src/lib/arquivos.ts — e quem serve é
// GET /api/artes/[nome], que exige sessão: arte de cliente não fica em URL
// pública. Por isso o blob também é privado.
const DEPOSITO = "artes";

export const TAMANHO_MAXIMO = 15 * 1024 * 1024; // 15MB

// Arte é o que vai pra impressão: imagem ou PDF. A lista é explícita de
// propósito — sem ela, todo formato novo em src/lib/arquivos.ts (o MP4 do
// vídeo do produto, por exemplo) passaria a valer como arte de cliente.
const FORMATOS_ARTE = ["png", "jpg", "pdf", "webp"] as const satisfies readonly Extensao[];

export function formatoDoConteudo(bytes: Buffer) {
  return formatoDoConteudoDeArquivo(bytes, FORMATOS_ARTE);
}

export async function salvarArte(bytes: Buffer, extensao: string) {
  const { nome } = await salvarArquivo(bytes, extensao, DEPOSITO);
  return { nome, url: `/api/artes/${nome}` };
}

export function nomeDeArteValido(nome: string) {
  return nomeValido(nome, FORMATOS_ARTE);
}

export async function lerArte(nome: string) {
  if (!nomeDeArteValido(nome)) return null;
  return lerArquivo(nome, DEPOSITO);
}

export function tipoDaArte(nome: string) {
  return tipoPeloNome(nome);
}
