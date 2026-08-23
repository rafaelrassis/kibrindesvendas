import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { ehUrlDeImagem } from "@/lib/imagens";
import { ehUrlDeVideo } from "@/lib/video";
import type { Produto, ProdutoAdmin } from "@/lib/types";
import type {
  Produto as ProdutoDb,
  Variacao as VariacaoDb,
  Categoria as CategoriaDb,
  MaterialProduto as MaterialProdutoDb,
  EstoqueVariacao as EstoqueVariacaoDb,
  Prisma,
} from "@prisma/client";
import { ErroDeNegocio } from "./erros";

type ProdutoComRelacoes = ProdutoDb & {
  categoria: CategoriaDb;
  variacoes: VariacaoDb[];
  estoqueVariacoes: EstoqueVariacaoDb[];
};

type ProdutoComMateriais = ProdutoComRelacoes & { materiais: MaterialProdutoDb[] };

// Dado antigo (antes do suporte a múltiplas fotos por cor) guarda uma string
// solta por valor; dado novo guarda um array de até 4. Normaliza os dois
// formatos pra array na leitura, assim produto cadastrado antes da migração
// continua mostrando a foto que já tinha.
function normalizarImagensValores(
  bruto: unknown
): Record<string, string[]> | null {
  if (!bruto || typeof bruto !== "object") return null;
  const entradas = Object.entries(bruto as Record<string, unknown>).map(([valor, urls]) => [
    valor,
    Array.isArray(urls) ? urls.filter((u): u is string => typeof u === "string") : typeof urls === "string" ? [urls] : [],
  ]);
  return Object.fromEntries(entradas);
}

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
    precoOriginal: p.precoOriginal ? Number(p.precoOriginal) : null,
    precoShopee: Number(p.precoShopee),
    vendidoNaShopee: p.vendidoNaShopee,
    requerPersonalizacao: p.requerPersonalizacao,
    mensagemPersonalizacao: p.mensagemPersonalizacao,
    diasProducaoExtra: p.diasProducaoExtra,
    emoji: p.emoji,
    cor: p.cor,
    imagens: p.imagens,
    video: p.video,
    destaque: p.destaque,
    destaqueCategoria: p.destaqueCategoria,
    ativo: p.ativo,
    variacoes: p.variacoes.map((v) => ({
      tipo: v.tipo,
      valores: v.valores,
      imagensValores: normalizarImagensValores(v.imagensValores),
    })),
    estoque: p.estoque,
    estoqueVariacoes: p.estoqueVariacoes.map((e) => ({
      combinacao: e.combinacao,
      estoque: e.estoque,
    })),
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

export const relacoesProduto = {
  categoria: true,
  variacoes: true,
  estoqueVariacoes: true,
} as const;
export const relacoesProdutoAdmin = {
  categoria: true,
  variacoes: true,
  estoqueVariacoes: true,
  materiais: true,
} as const;

export async function getProdutos(): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    include: relacoesProduto,
    orderBy: { nome: "asc" },
  });
  return produtos.map(toProduto);
}

export async function getDestaques(): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({
    where: { destaque: true, ativo: true },
    include: relacoesProduto,
    orderBy: { nome: "asc" },
  });
  return produtos.map(toProduto);
}

// Usado só pela loja (página pública e /api/produtos): produto pausado some
// daqui, mas continua acessível pelas rotas /api/admin.
export async function getProduto(id: string): Promise<Produto | undefined> {
  const produto = await prisma.produto.findUnique({ where: { id }, include: relacoesProduto });
  return produto && produto.ativo ? toProduto(produto) : undefined;
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

// Usado só na home: até `limite` produtos por categoria, com os marcados
// como destaqueCategoria vindo primeiro. Categoria sem produto ativo não
// entra no resultado.
export async function getProdutosAgrupadosPorCategoria(
  limite = 5
): Promise<{ categoria: { slug: string; label: string }; produtos: Produto[] }[]> {
  const categorias = await prisma.categoria.findMany({ orderBy: { label: "asc" } });
  const grupos = await Promise.all(
    categorias.map(async (c) => {
      const produtos = await prisma.produto.findMany({
        where: { categoriaId: c.id, ativo: true },
        include: relacoesProduto,
        orderBy: [{ destaqueCategoria: "desc" }, { nome: "asc" }],
        take: limite,
      });
      return { categoria: { slug: c.slug, label: c.label }, produtos: produtos.map(toProduto) };
    })
  );
  return grupos.filter((g) => g.produtos.length > 0);
}

export async function getProdutosPorCategoria(slug: string): Promise<Produto[]> {
  const produtos = await prisma.produto.findMany({
    where: { categoria: { slug }, ativo: true },
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
      ativo: true,
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
  // Preço "de", riscado na vitrine. null explícito desliga o desconto;
  // undefined deixa como está. Precisa ser maior que `preco` — ver validar().
  precoOriginal?: number | null;
  precoShopee?: number;
  vendidoNaShopee?: boolean;
  requerPersonalizacao?: boolean;
  // Texto do alerta de personalização. null/"" = usa o texto padrão.
  mensagemPersonalizacao?: string | null;
  // Dias extras de produção somados ao prazo de frete, independente de
  // requerPersonalizacao — todo produto pode ter produção mais longa.
  diasProducaoExtra?: number;
  emoji?: string;
  cor?: string;
  // Até 4 fotos (ordem = ordem de exibição) e 1 vídeo — ver validarMidia.
  imagens?: string[];
  video?: string | null;
  destaque?: boolean;
  destaqueCategoria?: boolean;
  // false pausa o produto (some da loja); undefined deixa como está.
  ativo?: boolean;
  variacoes?: { tipo: string; valores: string[]; imagensValores?: Record<string, string[]> | null }[];
  materiais?: { nome: string; quantidade: number; custoUnitario: number }[];
  // null explícito desliga o controle de estoque; undefined deixa como está.
  // Só se aplica a produto sem variações — com variações o controle é por
  // combinação, ver estoqueVariacoes abaixo.
  estoque?: number | null;
  // Uma linha por combinação (grade inteira, o form manda sempre tudo).
  // null explícito desliga o controle por variação (apaga todas as linhas);
  // undefined deixa como está; array substitui a grade inteira.
  estoqueVariacoes?: { combinacao: string; estoque: number }[] | null;
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
  if (dados.precoOriginal != null) {
    const precoAtual = dados.preco ?? 0;
    if (dados.precoOriginal <= precoAtual) {
      throw new ErroDeNegocio("O preço original precisa ser maior que o preço atual.");
    }
  }
  if (dados.imagens !== undefined) {
    if (dados.imagens.length > 4) {
      throw new ErroDeNegocio("No máximo 4 fotos por produto.");
    }
    if (dados.imagens.some((url) => !ehUrlDeImagem(url))) {
      throw new ErroDeNegocio("Foto inválida — envie pelo campo de upload.");
    }
  }
  if (dados.video !== undefined && dados.video && !ehUrlDeVideo(dados.video)) {
    throw new ErroDeNegocio("Vídeo inválido — envie pelo campo de upload.");
  }
  if (dados.descricaoDetalhada) {
    // Mesmo padrão que o botão "+ Inserir imagem" do admin grava: uma linha
    // sozinha `![](url)`. Cada URL encontrada tem que ser foto que passou
    // pelo upload da loja — nunca uma URL digitada à mão.
    const urlsDeImagem = [...dados.descricaoDetalhada.matchAll(/^!\[\]\(([^)]+)\)$/gm)].map(
      (m) => m[1]
    );
    if (urlsDeImagem.some((url) => !ehUrlDeImagem(url))) {
      throw new ErroDeNegocio("Imagem inválida na descrição detalhada — envie pelo campo de upload.");
    }
  }
  if (dados.variacoes) {
    for (const v of dados.variacoes) {
      for (const [valor, urls] of Object.entries(v.imagensValores ?? {})) {
        if (urls.length > 4) {
          throw new ErroDeNegocio(`No máximo 4 fotos por cor — "${valor}" tem ${urls.length}.`);
        }
        if (urls.some((url) => !ehUrlDeImagem(url))) {
          throw new ErroDeNegocio(`Foto inválida em "${valor}" — envie pelo campo de upload.`);
        }
      }
    }
  }
  if (dados.estoque != null && (!Number.isInteger(dados.estoque) || dados.estoque < 0)) {
    throw new ErroDeNegocio("O estoque precisa ser um número inteiro maior ou igual a zero.");
  }
  if (dados.estoqueVariacoes) {
    for (const linha of dados.estoqueVariacoes) {
      if (!linha.combinacao.trim()) {
        throw new ErroDeNegocio("Combinação de estoque inválida.");
      }
      if (!Number.isInteger(linha.estoque) || linha.estoque < 0) {
        throw new ErroDeNegocio(
          `O estoque de "${linha.combinacao}" precisa ser um número inteiro maior ou igual a zero.`
        );
      }
    }
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
      precoOriginal: dados.precoOriginal ?? null,
      precoShopee: dados.precoShopee ?? dados.preco,
      vendidoNaShopee: dados.vendidoNaShopee ?? true,
      requerPersonalizacao: !!dados.requerPersonalizacao,
      mensagemPersonalizacao: dados.mensagemPersonalizacao?.trim() || null,
      diasProducaoExtra: dados.diasProducaoExtra ?? 0,
      emoji: dados.emoji || EMOJI_PADRAO,
      cor: dados.cor || COR_PADRAO,
      imagens: dados.imagens ?? [],
      video: dados.video || null,
      destaque: !!dados.destaque,
      destaqueCategoria: !!dados.destaqueCategoria,
      estoque: dados.estoque ?? null,
      pesoGramas: dados.pesoGramas ?? PESO_PADRAO_G,
      alturaCm: dados.alturaCm ?? ALTURA_PADRAO_CM,
      larguraCm: dados.larguraCm ?? LARGURA_PADRAO_CM,
      comprimentoCm: dados.comprimentoCm ?? COMPRIMENTO_PADRAO_CM,
      variacoes: {
        create: (dados.variacoes ?? []).map((v) => ({
          tipo: v.tipo,
          valores: v.valores,
          imagensValores: v.imagensValores ?? undefined,
        })),
      },
      estoqueVariacoes: {
        create: (dados.estoqueVariacoes ?? []).map((e) => ({
          combinacao: e.combinacao,
          estoque: e.estoque,
        })),
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
    // A grade é sempre substituída em bloco, igual às variações: o form
    // manda a lista inteira (ou `null` pra desligar o controle).
    if (dados.estoqueVariacoes !== undefined) {
      await tx.estoqueVariacao.deleteMany({ where: { produtoId: id } });
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
        precoOriginal: dados.precoOriginal !== undefined ? dados.precoOriginal : undefined,
        precoShopee: dados.precoShopee,
        vendidoNaShopee: dados.vendidoNaShopee,
        requerPersonalizacao: dados.requerPersonalizacao,
        mensagemPersonalizacao:
          dados.mensagemPersonalizacao !== undefined
            ? dados.mensagemPersonalizacao?.trim() || null
            : undefined,
        diasProducaoExtra: dados.diasProducaoExtra,
        emoji: dados.emoji,
        cor: dados.cor,
        imagens: dados.imagens,
        video: dados.video !== undefined ? dados.video || null : undefined,
        destaque: dados.destaque,
        destaqueCategoria: dados.destaqueCategoria,
        ativo: dados.ativo,
        estoque: dados.estoque !== undefined ? dados.estoque : undefined,
        pesoGramas: dados.pesoGramas,
        alturaCm: dados.alturaCm,
        larguraCm: dados.larguraCm,
        comprimentoCm: dados.comprimentoCm,
        ...(dados.variacoes && {
          variacoes: {
            create: dados.variacoes.map((v) => ({
              tipo: v.tipo,
              valores: v.valores,
              imagensValores: v.imagensValores ?? undefined,
            })),
          },
        }),
        ...(dados.estoqueVariacoes && {
          estoqueVariacoes: {
            create: dados.estoqueVariacoes.map((e) => ({
              combinacao: e.combinacao,
              estoque: e.estoque,
            })),
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

// Chamada dentro da transação que cria o pedido, depois de já ter confirmado
// que há estoque suficiente. A condição é reconferida aqui pelo próprio
// Postgres, na mesma instrução que desconta — igual ao padrão de
// `registrarUsoCupom` em cupons.ts: duas compras simultâneas da última
// unidade não vendem a mesma peça duas vezes, porque a segunda transação
// espera a primeira commitar e só então vê o estoque já atualizado.
// Produto sem controle de estoque (`estoque: null`) não entra aqui — quem
// chama já filtra isso antes.
export async function decrementarEstoque(
  produtoId: string,
  quantidade: number,
  tx: Prisma.TransactionClient
) {
  const linhas = await tx.$executeRaw`
    UPDATE "Produto"
    SET estoque = estoque - ${quantidade}, "updatedAt" = NOW()
    WHERE id = ${produtoId}
      AND estoque IS NOT NULL
      AND estoque >= ${quantidade}
  `;
  if (linhas === 0) {
    throw new ErroDeNegocio("Este produto não tem mais estoque suficiente.", 409);
  }
}

// Devolve as unidades quando o pedido que as reservou não vinga (falha ao
// abrir o pagamento, por exemplo) — mesmo raciocínio de `devolverUsoCupom`.
export async function devolverEstoque(
  produtoId: string,
  quantidade: number,
  tx: Prisma.TransactionClient
) {
  await tx.produto.updateMany({
    where: { id: produtoId, estoque: { not: null } },
    data: { estoque: { increment: quantidade } },
  });
}

// Mesmo padrão de decrementarEstoque, só que por combinação: o UPDATE
// condicional (estoque >= quantidade) é o que garante que duas compras
// simultâneas da última unidade daquela combinação específica não vendem a
// mesma peça duas vezes. Combinação sem linha (0 linhas afetadas) cai no
// mesmo erro — é o mesmo resultado de "sem estoque suficiente".
export async function decrementarEstoqueVariacao(
  produtoId: string,
  combinacao: string,
  quantidade: number,
  tx: Prisma.TransactionClient
) {
  const linhas = await tx.$executeRaw`
    UPDATE "EstoqueVariacao"
    SET estoque = estoque - ${quantidade}, "updatedAt" = NOW()
    WHERE "produtoId" = ${produtoId}
      AND combinacao = ${combinacao}
      AND estoque >= ${quantidade}
  `;
  if (linhas === 0) {
    throw new ErroDeNegocio("Esta combinação não tem mais estoque suficiente.", 409);
  }
}

// Devolve as unidades de uma combinação quando o pedido não vinga — mesmo
// raciocínio de devolverEstoque, por combinação.
export async function devolverEstoqueVariacao(
  produtoId: string,
  combinacao: string,
  quantidade: number,
  tx: Prisma.TransactionClient
) {
  await tx.estoqueVariacao.updateMany({
    where: { produtoId, combinacao },
    data: { estoque: { increment: quantidade } },
  });
}
