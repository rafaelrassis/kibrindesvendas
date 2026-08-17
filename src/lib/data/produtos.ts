import "server-only";
import { prisma } from "@/lib/prisma";
import type { Produto } from "@/lib/types";
import type { Produto as ProdutoDb, Variacao as VariacaoDb, Categoria as CategoriaDb } from "@prisma/client";

type ProdutoComRelacoes = ProdutoDb & {
  categoria: CategoriaDb;
  variacoes: VariacaoDb[];
};

function toProduto(p: ProdutoComRelacoes): Produto {
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    categoria: p.categoria.slug,
    categoriaLabel: p.categoria.label,
    preco: Number(p.preco),
    precoShopee: Number(p.precoShopee),
    requerPersonalizacao: p.requerPersonalizacao,
    emoji: p.emoji,
    cor: p.cor,
    destaque: p.destaque,
    variacoes: p.variacoes.map((v) => ({ tipo: v.tipo, valores: v.valores })),
  };
}

const include = { categoria: true, variacoes: true } as const;

export async function getProdutos(): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({ include, orderBy: { nome: "asc" } });
  return produtos.map(toProduto);
}

export async function getDestaques(): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({
    where: { destaque: true },
    include,
    orderBy: { nome: "asc" },
  });
  return produtos.map(toProduto);
}

export async function getProduto(id: string): Promise<Produto | undefined> {
  const produto = await prisma.produto.findUnique({ where: { id }, include });
  return produto ? toProduto(produto) : undefined;
}

export async function getProdutosPorCategoria(slug: string): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({
    where: { categoria: { slug } },
    include,
    orderBy: { nome: "asc" },
  });
  return produtos.map(toProduto);
}

export async function buscarProdutos(termo: string): Promise<Produto[]> {
  const q = termo.trim();
  if (!q) return [];
  const produtos = await prisma.produto.findMany({
    where: {
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { descricao: { contains: q, mode: "insensitive" } },
      ],
    },
    include,
    orderBy: { nome: "asc" },
  });
  return produtos.map(toProduto);
}
