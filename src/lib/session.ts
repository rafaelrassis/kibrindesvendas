import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "kibrindes_session";
const DIA_EM_SEGUNDOS = 60 * 60 * 24 * 30;

function segredo() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não configurado (ver .env.example)");
  return s;
}

function assinar(valor: string) {
  return createHmac("sha256", segredo()).update(valor).digest("hex");
}

function empacotar(usuarioId: string) {
  const payload = `${usuarioId}.${Date.now()}`;
  const assinatura = assinar(payload);
  return Buffer.from(`${payload}.${assinatura}`).toString("base64url");
}

function desempacotar(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [usuarioId, ts, assinatura] = decoded.split(".");
    if (!usuarioId || !ts || !assinatura) return null;

    const esperada = assinar(`${usuarioId}.${ts}`);
    const a = Buffer.from(assinatura);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return usuarioId;
  } catch {
    return null;
  }
}

export async function criarSessao(usuarioId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, empacotar(usuarioId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIA_EM_SEGUNDOS,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function usuarioIdDaSessao(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token ? desempacotar(token) : null;
}

// --- Token de redefinição de senha -----------------------------------
// Mesmo esquema HMAC do cookie de sessão, mas com propósito e expiração
// próprios: o prefixo "reset" impede que um token de sessão vazado (ou
// vice-versa) seja reaproveitado pro outro fim.
//
// A assinatura também cobre o hash da senha atual, e é isso que faz o link
// valer uma vez só: assim que a senha muda o hash muda, e todo link emitido
// antes para de fechar a conta. Sem isso o link continuaria trocando a senha
// durante a hora inteira — e-mail fica guardado em caixa de entrada, é
// encaminhado, vaza; um link de redefinição não pode sobreviver ao uso.
const RESET_EM_MS = 60 * 60 * 1000; // 1 hora

export function gerarTokenRedefinicao(usuarioId: string, senhaHashAtual: string): string {
  const payload = `reset.${usuarioId}.${Date.now() + RESET_EM_MS}`;
  const assinatura = assinar(`${payload}.${senhaHashAtual}`);
  return Buffer.from(`${payload}.${assinatura}`).toString("base64url");
}

// Recebe como buscar o hash em vez de ler o banco aqui: este módulo continua
// só de cripto e cookie, e quem chama não tem como obter um id sem passar
// pela conferência da assinatura.
export async function usuarioIdDoTokenRedefinicao(
  token: string,
  buscarSenhaHash: (usuarioId: string) => Promise<string | null>
): Promise<string | null> {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [marca, usuarioId, expiraEmStr, assinatura] = decoded.split(".");
    if (marca !== "reset" || !usuarioId || !expiraEmStr || !assinatura) return null;

    if (Date.now() > Number(expiraEmStr)) return null;

    const senhaHashAtual = await buscarSenhaHash(usuarioId);
    if (!senhaHashAtual) return null;

    const esperada = assinar(`reset.${usuarioId}.${expiraEmStr}.${senhaHashAtual}`);
    const a = Buffer.from(assinatura);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return usuarioId;
  } catch {
    return null;
  }
}
