import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { Produto, ProdutoAdmin } from "@/lib/types";
import type {
  Produto as ProdutoDb,
  Variacao as VariacaoDb,
  Categoria as CategoriaDb,
  MaterialProduto as MaterialProdutoDb,
} from "@prisma/client";
import { ErroDeNegocio } from "./erros";

type ProdutoComRelacoes = ProdutoDb & {
  categoria: CategoriaDb;
  variacoes: VariacaoDb[];
};

type ProdutoComMateriais = ProdutoComRelacoes & { materiais: MaterialProdutoDb[] };

// Exportado porque outras consultas (favoritos, por exemplo) chegam no produto
// por outro caminho e precisam do mesmo formato de saída. Nunca inclui custo
// de material — isso só existe na versão admin, mais abaixo.
export function toProduto(p: ProdutoComRelacoes): Produto {
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    descricaoDetalhada: p.descricaoDetalhada,
    categoria: p.categoria.slug,
    categoriaLabel: p.categoria.label,
    preco: Number(p.preco),
    precoShopee: Number(p.precoShopee),
    vendidoNaShopee: p.vendidoNaShopee,
    requerPersonalizacao: p.requerPersonalizacao,
    emoji: p.emoji,
    cor: p.cor,
    destaque: p.destaque,
    variacoes: p.variacoes.map((v) => ({ tipo: v.tipo, valores: v.valores })),
    pesoGramas: p.pesoGramas,
    alturaCm: p.alturaCm,
    larguraCm: p.larguraCm,
    comprimentoCm: p.comprimentoCm,
  };
}

// Versão pra /admin: junto do produto normal, calcula o custo de material e a
// margem — dado sensível que só sai por rota autenticada de admin.
export function toProdutoAdmin(p: ProdutoComMateriais): ProdutoAdmin {
  const materiais = p.materiais.map((m) => ({
    id: m.id,
    nome: m.nome,
    quantidade: Number(m.quantidade),
    custoUnitario: Number(m.custoUnitario),
  }));
  const custoTotal = materiais.reduce((soma, m) => soma + m.quantidade * m.custoUnitario, 0);
  const preco = Number(p.preco);
  const lucro = Math.round((preco - custoTotal) * 100) / 100;
  return {
    ...toProduto(p),
    materiais,
    custoTotal: Math.round(custoTotal * 100) / 100,
    lucro,
    margemPercentual: preco > 0 ? Math.round((lucro / preco) * 1000) / 10 : null,
  };
}

export const relacoesProduto = { categoria: true, variacoes: true } as const;
export const relacoesProdutoAdmin = {
  categoria: true,
  variacoes: true,
  materiais: true,
} as const;

export async function getProdutos(): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({ include: relacoesProduto, orderBy: { nome: "asc" } });
  return produtos.map(toProduto);
}

export async function getDestaques(): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({
    where: { destaque: true },
    include: relacoesProduto,
    orderBy: { nome: "asc" },
  });
  return produtos.map(toProduto);
}

export async function getProduto(id: string): Promise<Produto | undefined> {
  const produto = await prisma.produto.findUnique({ where: { id }, include: relacoesProduto });
  return produto ? toProduto(produto) : undefined;
}

// --- Leitura (admin) — inclui custo de material e margem ------------------

export async function getProdutosAdmin(): Promise<ProdutoAdmin[]> {
  const produtos = await prisma.produto.findMany({
    include: relacoesProdutoAdmin,
    orderBy: { nome: "asc" },
  });
  return produtos.map(toProdutoAdmin);
}

export async function getProdutoAdmin(id: string): Promise<ProdutoAdmin | undefined> {
  const produto = await prisma.produto.findUnique({
    where: { id },
    include: relacoesProdutoAdmin,
  });
  return produto ? toProdutoAdmin(produto) : undefined;
}

export async function getProdutosPorCategoria(slug: string): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({
    where: { categoria: { slug } },
    include: relacoesProduto,
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
    include: relacoesProduto,
    orderBy: { nome: "asc" },
  });
  return produtos.map(toProduto);
}

// --- Escrita (admin) -------------------------------------------------------

export type DadosProduto = {
  nome: string;
  descricao?: string;
  descricaoDetalhada?: string | null;
  categoriaSlug: string;
  preco: number;
  precoShopee?: number;
  vendidoNaShopee?: boolean;
  requerPersonalizacao?: boolean;
  emoji?: string;
  cor?: string;
  destaque?: boolean;
  variacoes?: { tipo: string; valores: string[] }[];
  materiais?: { nome: string; quantidade: number; custoUnitario: number }[];
  pesoGramas?: number;
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;
};

const EMOJI_PADRAO = "🎁";
const COR_PADRAO = "#3F6B4C";
// Caixa pequena — mesmo padrão do `@default` no schema, usado quando o
// admin cria o produto sem preencher peso/dimensões.
const PESO_PADRAO_G = 300;
const ALTURA_PADRAO_CM = 4;
const LARGURA_PADRAO_CM = 11;
const COMPRIMENTO_PADRAO_CM = 16;

async function categoriaIdPorSlug(slug: string) {
  const categoria = await prisma.categoria.findUnique({ where: { slug } });
  if (!categoria) throw new ErroDeNegocio("Categoria não encontrada.", 404);
  return categoria.id;
}

function validar(dados: Partial<DadosProduto>) {
  if (dados.nome !== undefined && !dados.nome.trim()) {
    throw new ErroDeNegocio("Informe o nome do produto.");
  }
  if (dados.preco !== undefined && !(dados.preco > 0)) {
    throw new ErroDeNegocio("Informe um preço maior que zero.");
  }
  if (dados.precoShopee !== undefined && dados.precoShopee < 0) {
    throw new ErroDeNegocio("O preço da Shopee não pode ser negativo.");
  }
}

export async function criarProduto(dados: DadosProduto): Promise<Produto> {
  if (!dados.nome?.trim() || !dados.categoriaSlug || dados.preco === undefined) {
    throw new ErroDeNegocio("Preencha nome, categoria e preço.");
  }
  validar(dados);

  const categoriaId = await categoriaIdPorSlug(dados.categoriaSlug);

  // O id vem do nome (é ele que aparece na URL do produto); o sufixo evita
  // colisão entre dois produtos de nome parecido.
  const id = `${slugify(dados.nome) || "produto"}-${Date.now().toString(36)}`;

  const produto = await prisma.produto.create({
    data: {
      id,
      nome: dados.nome.trim(),
      descricao: dados.descricao?.trim() ?? "",
      descricaoDetalhada: dados.descricaoDetalhada?.trim() || null,
      categoriaId,
      preco: dados.preco,
      precoShopee: dados.precoShopee ?? dados.preco,
      vendidoNaShopee: dados.vendidoNaShopee ?? true,
      requerPersonalizacao: !!dados.requerPersonalizacao,
      emoji: dados.emoji || EMOJI_PADRAO,
      cor: dados.cor || COR_PADRAO,
      destaque: !!dados.destaque,
      pesoGramas: dados.pesoGramas ?? PESO_PADRAO_G,
      alturaCm: dados.alturaCm ?? ALTURA_PADRAO_CM,
      larguraCm: dados.larguraCm ?? LARGURA_PADRAO_CM,
      comprimentoCm: dados.comprimentoCm ?? COMPRIMENTO_PADRAO_CM,
      variacoes: {
        create: (dados.variacoes ?? []).map((v) => ({ tipo: v.tipo, valores: v.valores })),
      },
      materiais: {
        create: (dados.materiais ?? []).map((m) => ({
          nome: m.nome,
          quantidade: m.quantidade,
          custoUnitario: m.custoUnitario,
        })),
      },
    },
    include: relacoesProduto,
  });
  return toProduto(produto);
}

export async function atualizarProduto(
  id: string,
  dados: Partial<DadosProduto>
): Promise<Produto> {
  const atual = await prisma.produto.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Produto não encontrado.", 404);
  validar(dados);

  const categoriaId = dados.categoriaSlug
    ? await categoriaIdPorSlug(dados.categoriaSlug)
    : undefined;

  // As variações são substituídas em bloco (o formulário manda a lista
  // inteira), então apagar e recriar precisa ser atômico.
  const produto = await prisma.$transaction(async (tx) => {
    if (dados.variacoes) {
      await tx.variacao.deleteMany({ where: { produtoId: id } });
    }
    if (dados.materiais) {
      await tx.materialProduto.deleteMany({ where: { produtoId: id } });
    }

    return tx.produto.update({
      where: { id },
      data: {
        nome: dados.nome?.trim(),
        descricao: dados.descricao?.trim(),
        descricaoDetalhada:
          dados.descricaoDetalhada !== undefined
            ? dados.descricaoDetalhada?.trim() || null
            : undefined,
        categoriaId,
        preco: dados.preco,
        precoShopee: dados.precoShopee,
        vendidoNaShopee: dados.vendidoNaShopee,
        requerPersonalizacao: dados.requerPersonalizacao,
        emoji: dados.emoji,
        cor: dados.cor,
        destaque: dados.destaque,
        pesoGramas: dados.pesoGramas,
        alturaCm: dados.alturaCm,
        larguraCm: dados.larguraCm,
        comprimentoCm: dados.comprimentoCm,
        ...(dados.variacoes && {
          variacoes: {
            create: dados.variacoes.map((v) => ({ tipo: v.tipo, valores: v.valores })),
          },
        }),
        ...(dados.materiais && {
          materiais: {
            create: dados.materiais.map((m) => ({
              nome: m.nome,
              quantidade: m.quantidade,
              custoUnitario: m.custoUnitario,
            })),
          },
        }),
      },
      include: relacoesProduto,
    });
  });
  return toProduto(produto);
}

export async function removerProduto(id: string) {
  const atual = await prisma.produto.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Produto não encontrado.", 404);

  const emUso = await prisma.itemPedido.count({ where: { produtoId: id } });
  if (emUso > 0) {
    throw new ErroDeNegocio(
      `Não é possível remover: produto está em ${emUso} pedido(s).`,
      409
    );
  }

  await prisma.produto.delete({ where: { id } });
}
