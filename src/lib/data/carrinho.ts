import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ItemCarrinho } from "@/lib/cart-context";
import { ErroDeNegocio } from "./erros";

// A sacola persistida é só pra quem está logado — visitante continua inteiro
// no localStorage (ver cart-context.tsx). Aqui é só o espelho no banco, pra
// sobreviver a troca de aparelho e a payment que demora (boleto) sem depender
// da aba continuar aberta.

function paraItemCarrinho(linha: {
  produtoId: string;
  variacoesEscolhidas: unknown;
  quantidade: number;
  cepInformado: string | null;
  personalizacao: unknown;
}): ItemCarrinho {
  const item: ItemCarrinho = {
    produtoId: linha.produtoId,
    variacoesEscolhidas: (linha.variacoesEscolhidas as Record<string, string>) ?? {},
    quantidade: linha.quantidade,
  };
  if (linha.cepInformado) item.cepInformado = linha.cepInformado;
  if (linha.personalizacao) {
    item.personalizacao = linha.personalizacao as ItemCarrinho["personalizacao"];
  }
  return item;
}

export async function getCarrinho(usuarioId: string): Promise<ItemCarrinho | null> {
  const linha = await prisma.carrinhoItem.findUnique({ where: { usuarioId } });
  return linha ? paraItemCarrinho(linha) : null;
}

// Upsert de um jeito só: a sacola é sempre um item por usuário, então salvar
// substitui o que tinha antes em vez de acumular.
export async function salvarCarrinho(usuarioId: string, item: unknown): Promise<ItemCarrinho> {
  if (
    !item ||
    typeof item !== "object" ||
    typeof (item as ItemCarrinho).produtoId !== "string" ||
    !(item as ItemCarrinho).produtoId
  ) {
    throw new ErroDeNegocio("Item da sacola inválido.");
  }

  const bruto = item as ItemCarrinho;
  const quantidade = Math.max(1, Math.round(Number(bruto.quantidade)) || 1);
  // Json nullable do Prisma não aceita `null` cru pra "apagar o campo" — pede
  // o sentinela `Prisma.JsonNull`, senão o TS lê como "não alterar nada".
  const personalizacao = bruto.personalizacao
    ? (bruto.personalizacao as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  const linha = await prisma.carrinhoItem.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      produtoId: bruto.produtoId,
      variacoesEscolhidas: bruto.variacoesEscolhidas ?? {},
      quantidade,
      cepInformado: bruto.cepInformado ?? null,
      personalizacao,
    },
    update: {
      produtoId: bruto.produtoId,
      variacoesEscolhidas: bruto.variacoesEscolhidas ?? {},
      quantidade,
      cepInformado: bruto.cepInformado ?? null,
      personalizacao,
    },
  });

  return paraItemCarrinho(linha);
}

export async function limparCarrinho(usuarioId: string) {
  // `deleteMany` em vez de `delete`: chamado também pelo webhook de
  // pagamento, onde não há garantia de que ainda exista uma linha (o cliente
  // pode já ter limpado a sacola por conta própria).
  await prisma.carrinhoItem.deleteMany({ where: { usuarioId } });
}
