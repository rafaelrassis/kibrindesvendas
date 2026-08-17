import "server-only";
import {
  formatoDoConteudo,
  lerArquivo,
  nomeValido,
  salvarArquivo,
  tipoPeloNome,
  type Extensao,
} from "@/lib/arquivos";

// Imagem da própria loja (hoje, o banner da home). Separada das artes de
// cliente de propósito: aqui o arquivo é gravado por admin e servido pra
// visitante deslogado por GET /api/imagens/[nome], sem sessão. Misturar as
// duas coisas no mesmo depósito abriria as artes junto.
const DEPOSITO = "imagens";

export const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024; // 5MB

// Banner é fundo de <div>: PDF não entra.
const FORMATOS_IMAGEM = ["png", "jpg", "webp"] as const satisfies readonly Extensao[];

export function formatoDeImagem(bytes: Buffer) {
  return formatoDoConteudo(bytes, FORMATOS_IMAGEM);
}

export async function salvarImagem(bytes: Buffer, extensao: string) {
  const { nome } = await salvarArquivo(bytes, extensao, DEPOSITO);
  return { nome, url: urlDaImagem(nome) };
}

export function nomeDeImagemValido(nome: string) {
  return nomeValido(nome, FORMATOS_IMAGEM);
}

export async function lerImagem(nome: string) {
  if (!nomeDeImagemValido(nome)) return null;
  return lerArquivo(nome, DEPOSITO);
}

export function tipoDaImagem(nome: string) {
  return tipoPeloNome(nome);
}

function urlDaImagem(nome: string) {
  return `/api/imagens/${nome}`;
}

// Usada pela camada de dados antes de gravar: a URL da imagem vai parar dentro
// de `background-image: url(...)` na home, então só aceitamos o que nós mesmos
// devolvemos no upload — nunca uma URL digitada.
export function ehUrlDeImagem(url: string) {
  const nome = url.startsWith("/api/imagens/") ? url.slice("/api/imagens/".length) : "";
  return nome !== "" && nomeDeImagemValido(nome);
}
