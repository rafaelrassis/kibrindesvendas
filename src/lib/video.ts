import "server-only";
import {
  formatoDoConteudo,
  lerArquivo,
  nomeValido,
  salvarArquivo,
  tipoPeloNome,
  type Extensao,
} from "@/lib/arquivos";

// Vídeo do produto (no máximo 1 por cadastro). Mesmo depósito público das
// imagens da loja — só muda o formato aceito e a rota que serve de volta.
const DEPOSITO = "imagens";

export const TAMANHO_MAXIMO_VIDEO = 30 * 1024 * 1024; // 30MB

const FORMATOS_VIDEO = ["mp4"] as const satisfies readonly Extensao[];

export function formatoDeVideo(bytes: Buffer) {
  return formatoDoConteudo(bytes, FORMATOS_VIDEO);
}

export async function salvarVideo(bytes: Buffer, extensao: string) {
  const { nome } = await salvarArquivo(bytes, extensao, DEPOSITO);
  return { nome, url: urlDoVideo(nome) };
}

export function nomeDeVideoValido(nome: string) {
  return nomeValido(nome, FORMATOS_VIDEO);
}

export async function lerVideo(nome: string) {
  if (!nomeDeVideoValido(nome)) return null;
  return lerArquivo(nome, DEPOSITO);
}

export function tipoDoVideo(nome: string) {
  return tipoPeloNome(nome);
}

function urlDoVideo(nome: string) {
  return `/api/videos/${nome}`;
}

// Mesmo espírito de `ehUrlDeImagem`: só aceita URL que nós mesmos devolvemos
// no upload, nunca um endereço digitado.
export function ehUrlDeVideo(url: string) {
  const nome = url.startsWith("/api/videos/") ? url.slice("/api/videos/".length) : "";
  return nome !== "" && nomeDeVideoValido(nome);
}
