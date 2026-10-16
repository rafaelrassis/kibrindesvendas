import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroDeNegocio } from "./erros";
import { valorDasLinhas } from "./carrinho-valor";
import { MAX_LINHAS_CARRINHO } from "./carrinho";

// Visitante que pede pra guardarmos o carrinho por e-mail. Sem conta, sem
// senha: o acesso é pelo `token` secreto que só vai no e-mail. Guarda só o
// necessário pra remontar o carrinho (produto, variações, quantidade) — arte e
// personalização ficam de fora, o cliente refaz ao voltar.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Quem salva de novo logo depois de receber um lembrete não dispara outro antes
// disto: evita virar um jeito de mandar e-mail em sequência pra um endereço.
const REAVISO_APOS_DIAS = 3;

export type LinhaVisitante = {
  produtoId: string;
  variacoesEscolhidas: Record<string, string>;
  quantidade: number;
};

function lerLinhas(bruto: unknown): LinhaVisitante[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.slice(0, MAX_LINHAS_CARRINHO).flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const { produtoId, variacoesEscolhidas, quantidade } = e as Record<string, unknown>;
    if (typeof produtoId !== "string" || !produtoId) return [];
    const variacoes: Record<string, string> = {};
    if (variacoesEscolhidas && typeof variacoesEscolhidas === "object") {
      for (const [k, v] of Object.entries(variacoesEscolhidas)) {
        if (typeof v === "string") variacoes[k] = v;
      }
    }
    return [
      {
        produtoId,
        variacoesEscolhidas: variacoes,
        quantidade: Math.max(1, Math.round(Number(quantidade)) || 1),
      },
    ];
  });
}

export async function salvarCarrinhoVisitante(
  emailBruto: unknown,
  itensBrutos: unknown,
  consentimento: unknown
) {
  if (consentimento !== true) {
    throw new ErroDeNegocio("Confirme que aceita receber o lembrete por e-mail.");
  }
  const email = typeof emailBruto === "string" ? emailBruto.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) {
    throw new ErroDeNegocio("Informe um e-mail válido.");
  }

  // Só produto que existe e está à venda: lixo mandado pelo navegador não vira
  // linha guardada nem aparece depois no e-mail.
  const candidatas = lerLinhas(itensBrutos);
  const validos = await prisma.produto.findMany({
    where: { id: { in: candidatas.map((l) => l.produtoId) }, ativo: true },
    select: { id: true },
  });
  const ids = new Set(validos.map((p) => p.id));
  const linhas = candidatas.filter((l) => ids.has(l.produtoId));
  if (linhas.length === 0) throw new ErroDeNegocio("Seu carrinho está vazio.");

  const valorCarrinho = await valorDasLinhas(linhas);
  const itens = linhas as unknown as Prisma.InputJsonValue;

  const existente = await prisma.carrinhoVisitante.findUnique({ where: { email } });
  if (!existente) {
    await prisma.carrinhoVisitante.create({
      data: { email, token: randomBytes(24).toString("base64url"), itens, valorCarrinho },
    });
    return;
  }

  const recente =
    existente.lembreteEm &&
    existente.lembreteEm.getTime() > Date.now() - REAVISO_APOS_DIAS * 24 * 60 * 60 * 1000;
  await prisma.carrinhoVisitante.update({
    where: { email },
    data: { itens, valorCarrinho, lembreteEm: recente ? existente.lembreteEm : null },
  });
}

// Abre o carrinho pelo link do e-mail e marca como recuperado. Token
// desconhecido (ou já apagado) é "não encontrado", sem distinguir os dois.
export async function recuperarCarrinhoVisitante(token: string): Promise<LinhaVisitante[]> {
  const registro = await prisma.carrinhoVisitante.findUnique({ where: { token } });
  if (!registro) throw new ErroDeNegocio("Este link não é mais válido.", 404);
  await prisma.carrinhoVisitante.update({
    where: { token },
    data: { restauradoEm: new Date() },
  });
  return lerLinhas(registro.itens);
}

export async function removerCarrinhoVisitante(token: string) {
  // deleteMany: apagar duas vezes (clique repetido) não é erro.
  await prisma.carrinhoVisitante.deleteMany({ where: { token } });
}
