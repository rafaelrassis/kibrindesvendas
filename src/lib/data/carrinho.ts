import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ItemCarrinho } from "@/lib/cart-context";
import { ErroDeNegocio } from "./erros";

// O carrinho persistido é só pra quem está logado — visitante continua inteiro
// no localStorage (ver cart-context.tsx). Aqui é só o espelho no banco, pra
// sobreviver a troca de aparelho e a pagamento que demora (boleto) sem depender
// da aba continuar aberta.

// Teto de linhas: o carrinho vem do navegador, então não confiamos que ele
// seja pequeno.
export const MAX_LINHAS_CARRINHO = 30;

function paraItemCarrinho(linha: {
  chave: string;
  produtoId: string;
  variacoesEscolhidas: unknown;
  quantidade: number;
  cepInformado: string | null;
  personalizacao: unknown;
}): ItemCarrinho {
  const item: ItemCarrinho = {
    id: linha.chave,
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

export async function getCarrinho(usuarioId: string): Promise<ItemCarrinho[]> {
  const linhas = await prisma.carrinhoItem.findMany({
    where: { usuarioId },
    orderBy: [{ ordem: "asc" }, { updatedAt: "asc" }],
  });
  return linhas.map(paraItemCarrinho);
}

// Salvar substitui o carrinho inteiro: o navegador manda o estado completo, e
// o banco passa a ser exatamente isso (linhas removidas somem, novas entram).
// Aceita também um item solto (formato antigo de 1 item só).
export async function salvarCarrinho(usuarioId: string, entrada: unknown): Promise<ItemCarrinho[]> {
  const lista = Array.isArray(entrada) ? entrada : [entrada];
  if (lista.length > MAX_LINHAS_CARRINHO) {
    throw new ErroDeNegocio(`O carrinho aceita no máximo ${MAX_LINHAS_CARRINHO} itens.`);
  }

  const vistas = new Set<string>();
  const linhas = lista.map((bruto, ordem) => {
    if (
      !bruto ||
      typeof bruto !== "object" ||
      typeof (bruto as ItemCarrinho).produtoId !== "string" ||
      !(bruto as ItemCarrinho).produtoId
    ) {
      throw new ErroDeNegocio("Item do carrinho inválido.");
    }
    const item = bruto as ItemCarrinho;
    // Item vindo do formato antigo não tem id: usa a posição, que já é única.
    const chave =
      typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 64) : `item-${ordem}`;
    if (vistas.has(chave)) throw new ErroDeNegocio("Carrinho com itens repetidos.");
    vistas.add(chave);

    return {
      usuarioId,
      chave,
      ordem,
      produtoId: item.produtoId,
      variacoesEscolhidas: (item.variacoesEscolhidas ?? {}) as Prisma.InputJsonValue,
      quantidade: Math.max(1, Math.round(Number(item.quantidade)) || 1),
      cepInformado: item.cepInformado ?? null,
      // Json nullable do Prisma não aceita `null` cru pra "apagar o campo" —
      // pede o sentinela `Prisma.JsonNull`.
      personalizacao: item.personalizacao
        ? (item.personalizacao as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };
  });

  await prisma.$transaction([
    prisma.carrinhoItem.deleteMany({ where: { usuarioId } }),
    prisma.carrinhoItem.createMany({ data: linhas }),
  ]);

  return getCarrinho(usuarioId);
}

export async function limparCarrinho(usuarioId: string) {
  // `deleteMany` em vez de `delete`: chamado também pelo webhook de
  // pagamento, onde não há garantia de que ainda exista uma linha (o cliente
  // pode já ter limpado o carrinho por conta própria).
  await prisma.carrinhoItem.deleteMany({ where: { usuarioId } });
}
