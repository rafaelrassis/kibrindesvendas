import "server-only";
import { prisma } from "@/lib/prisma";
import {
  chaveUrlFornecedor,
  extrairDadosProduto,
  extrairUrlsProdutos,
  extrairVariantesNuvemshop,
  precoComMargem,
  validarUrlFornecedor,
} from "@/lib/fornecedor";
import { baixarPagina, sincronizarProdutoAgora } from "./sync-fornecedor";
import { criarProduto } from "./produtos";
import { ErroDeNegocio } from "./erros";

// Importação de produtos da loja do fornecedor (Nuvemshop) que ainda não
// existem aqui. A lista vem do sitemap.xml; "já existe" = algum produto daqui
// tem aquele link em fornecedorUrl.

const PARALELO = 4;
const MAX_PRODUTOS = 100;

export type NovoDoFornecedor = { url: string; nome: string };

export async function listarNovosDoFornecedor(site: string) {
  const base = validarUrlFornecedor(site);
  if (!base) throw new ErroDeNegocio("Informe o endereço do site (https://...).");
  const origem = new URL(base).origin;

  let xml: string;
  try {
    const res = await fetch(`${origem}/sitemap.xml`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/xml,text/xml" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    xml = await res.text();
  } catch {
    throw new ErroDeNegocio("Não consegui abrir o sitemap do site — confira o endereço.");
  }

  const todas = extrairUrlsProdutos(xml).slice(0, MAX_PRODUTOS);
  if (todas.length === 0) throw new ErroDeNegocio("Não achei produtos nesse site.");

  const existentes = await prisma.produto.findMany({
    where: { fornecedorUrl: { not: null } },
    select: { fornecedorUrl: true },
  });
  const jaTem = new Set(existentes.map((p) => chaveUrlFornecedor(p.fornecedorUrl!)));
  const novas = todas.filter((u) => !jaTem.has(chaveUrlFornecedor(u)));

  // Nome de cada página nova, poucas por vez.
  const novos: NovoDoFornecedor[] = [];
  for (let i = 0; i < novas.length; i += PARALELO) {
    const lote = await Promise.all(
      novas.slice(i, i + PARALELO).map(async (url) => {
        try {
          return { url, nome: extrairDadosProduto(await baixarPagina(url)).nome || url };
        } catch {
          return { url, nome: url };
        }
      })
    );
    novos.push(...lote);
  }
  return { total: todas.length, jaCadastrados: todas.length - novas.length, novos };
}

// Cria o produto (pausado) a partir da página do fornecedor e já roda a
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

  const html = await baixarPagina(url);
  const { nome, descricao } = extrairDadosProduto(html);
  if (!nome) throw new ErroDeNegocio("Não achei o nome do produto na página.");
  const precos = extrairVariantesNuvemshop(html)
    .map((v) => v.preco)
    .filter((p): p is number => p != null && p > 0);
  if (precos.length === 0) throw new ErroDeNegocio("Não achei o preço do produto na página.");

  const criado = await criarProduto({
    nome,
    descricao,
    categoriaSlug,
    preco: precoComMargem(Math.min(...precos), margemPct),
    fornecedorUrl: url,
    fornecedorEspelhar: true,
  });
  // Entra pausado: o admin revisa preço e fotos antes de publicar.
  await prisma.produto.update({ where: { id: criado.id }, data: { ativo: false } });
  const sync = await sincronizarProdutoAgora(criado.id);
  return { id: criado.id, nome, categoria: criado.categoria, sync };
}
