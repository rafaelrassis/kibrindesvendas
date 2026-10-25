import "server-only";
import { prisma } from "@/lib/prisma";
import {
  chaveUrlFornecedor,
  precoComMargem,
  urlProdutoLoja,
  validarUrlFornecedor,
} from "@/lib/fornecedor";
import { buscarLojaFornecedor, buscarProdutoFornecedor, sincronizarProdutoAgora } from "./sync-fornecedor";
import { criarProduto } from "./produtos";
import { ErroDeNegocio } from "./erros";

// Importação de produtos da loja do fornecedor (Sete Malhas) que ainda não
// existem aqui. A API da loja devolve todos os produtos de uma vez; "já
// existe" = algum produto daqui tem aquele link em fornecedorUrl.

const MAX_PRODUTOS = 200;

export type NovoDoFornecedor = { url: string; nome: string };

export async function listarNovosDoFornecedor(site: string) {
  const base = validarUrlFornecedor(site);
  if (!base) throw new ErroDeNegocio("Informe o endereço do site (https://...).");
  const origem = new URL(base).origin;

  let loja;
  try {
    loja = await buscarLojaFornecedor(new URL(base).hostname);
  } catch {
    throw new ErroDeNegocio("Não consegui abrir a loja desse site — confira o endereço.");
  }
  const produtos = loja.produtos.slice(0, MAX_PRODUTOS);
  if (produtos.length === 0) throw new ErroDeNegocio("Não achei produtos nesse site.");

  const existentes = await prisma.produto.findMany({
    where: { fornecedorUrl: { not: null } },
    select: { fornecedorUrl: true },
  });
  const jaTem = new Set(existentes.map((p) => chaveUrlFornecedor(p.fornecedorUrl!)));

  const novos: NovoDoFornecedor[] = [];
  for (const p of produtos) {
    const url = urlProdutoLoja(origem, p.referencia);
    if (!jaTem.has(chaveUrlFornecedor(url))) novos.push({ url, nome: p.nome });
  }
  return { total: produtos.length, jaCadastrados: produtos.length - novos.length, novos };
}

// Cria o produto (pausado) a partir dos dados do fornecedor e já roda a
// sincronização: variações, fotos e estoque vêm do espelhamento.
export async function importarProdutoDoFornecedor(
  urlBruta: string,
  categoriaSlug: string,
  margemPct: number
) {
  const url = validarUrlFornecedor(urlBruta);
  if (!url) throw new ErroDeNegocio("Link inválido.");
  if (!categoriaSlug) throw new ErroDeNegocio("Escolha a categoria.");
  if (!Number.isFinite(margemPct) || margemPct < 0 || margemPct > 1000) {
    throw new ErroDeNegocio("Margem inválida.");
  }

  const chave = chaveUrlFornecedor(url);
  const existentes = await prisma.produto.findMany({
    where: { fornecedorUrl: { not: null } },
    select: { fornecedorUrl: true },
  });
  if (existentes.some((p) => chaveUrlFornecedor(p.fornecedorUrl!) === chave)) {
    throw new ErroDeNegocio("Este produto já foi importado.");
  }

  const { produto, variantes } = await buscarProdutoFornecedor(url);
  const precos = variantes.map((v) => v.preco).filter((p): p is number => p != null && p > 0);
  if (precos.length === 0) throw new ErroDeNegocio("Não achei o preço do produto no fornecedor.");

  const criado = await criarProduto({
    nome: produto.nome,
    descricao: produto.descricao ?? "",
    categoriaSlug,
    preco: precoComMargem(Math.min(...precos), margemPct),
    fornecedorUrl: url,
    fornecedorEspelhar: true,
  });
  // Entra pausado: o admin revisa preço e fotos antes de publicar.
  await prisma.produto.update({ where: { id: criado.id }, data: { ativo: false } });
  const sync = await sincronizarProdutoAgora(criado.id);
  return { id: criado.id, nome: produto.nome, categoria: criado.categoria, sync };
}
