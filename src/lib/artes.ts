import "server-only";
import {
  formatoDoConteudo as formatoDoConteudoDeArquivo,
  lerArquivo,
  nomeValido,
  salvarArquivo,
  tipoPeloNome,
} from "@/lib/arquivos";

// Arte enviada pelo cliente. Fica em `artes/` (Vercel Blob) ou
// `var/uploads/artes/` (dev) — ver src/lib/arquivos.ts — e quem serve é
// GET /api/artes/[nome], que exige sessão: arte de cliente não fica em URL
// pública. Por isso o blob também é privado.
const DEPOSITO = "artes";

export const TAMANHO_MAXIMO = 15 * 1024 * 1024; // 15MB

export function formatoDoConteudo(bytes: Buffer) {
  return formatoDoConteudoDeArquivo(bytes);
}

export async function salvarArte(bytes: Buffer, extensao: string) {
  const { nome } = await salvarArquivo(bytes, extensao, DEPOSITO);
  return { nome, url: `/api/artes/${nome}` };
}

export function nomeDeArteValido(nome: string) {
  return nomeValido(nome);
}

export async function lerArte(nome: string) {
  if (!nomeDeArteValido(nome)) return null;
  return lerArquivo(nome, DEPOSITO);
}

export function tipoDaArte(nome: string) {
  return tipoPeloNome(nome);
}
