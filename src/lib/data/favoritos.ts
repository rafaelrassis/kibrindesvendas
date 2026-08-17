import "server-only";
import { prisma } from "@/lib/prisma";
import type { Produto } from "@/lib/types";
import { relacoesProduto, toProduto } from "./produtos";
import { ErroDeNegocio } from "./erros";

export async function getFavoritos(usuarioId: string): Promise<Produto[]> {
  const favoritos = await prisma.favorito.findMany({
    where: { usuarioId },
    include: { produto: { include: relacoesProduto } },
    orderBy: { createdAt: "desc" }, // mais recentes primeiro, como na lista antiga
  });
  return favoritos.map((f) => toProduto(f.produto));
}

export async function favoritar(usuarioId: string, produtoId: string) {
  const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
  if (!produto) throw new ErroDeNegocio("Produto não encontrado.", 404);

  // upsert em vez de create: favoritar de novo (outra aba, clique repetido) é
  // o mesmo resultado, não um erro de chave duplicada.
  await prisma.favorito.upsert({
    where: { usuarioId_produtoId: { usuarioId, produtoId } },
    update: {},
    create: { usuarioId, produtoId },
  });
}

export async function desfavoritar(usuarioId: string, produtoId: string) {
  // deleteMany não reclama quando não há o que apagar — desfavoritar algo que
  // já saiu da lista continua sendo sucesso.
  await prisma.favorito.deleteMany({ where: { usuarioId, produtoId } });
}
