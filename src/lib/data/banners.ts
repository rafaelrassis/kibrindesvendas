import "server-only";
import type { Banner as BannerDb } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ehUrlDeImagem } from "@/lib/imagens";
import type { Banner, BannerAdmin } from "@/lib/types";
import { ErroDeNegocio } from "./erros";

const COR_PADRAO = "#3F6B4C";
const COR_VALIDA = /^#[0-9a-fA-F]{6}$/;

type DadosBanner = {
  titulo?: string;
  eyebrow?: string;
  precoTexto?: string;
  ctaHref?: string;
  imagemUrl?: string | null;
  corFundo?: string;
  ativo?: boolean;
};

function paraBanner(b: BannerDb): Banner {
  return {
    id: b.id,
    titulo: b.titulo,
    eyebrow: b.eyebrow,
    precoTexto: b.precoTexto,
    ctaHref: b.ctaHref,
    imagemUrl: b.imagemUrl,
    corFundo: b.corFundo,
  };
}

function paraBannerAdmin(b: BannerDb): BannerAdmin {
  return { ...paraBanner(b), ordem: b.ordem, ativo: b.ativo };
}

// O carrossel da home. Slide inativo não sai da lista da área interna, mas não
// chega na loja.
export async function getBannersAtivos(): Promise<Banner[]> {
  const banners = await prisma.banner.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
  });
  return banners.map(paraBanner);
}

export async function getBanners(): Promise<BannerAdmin[]> {
  const banners = await prisma.banner.findMany({ orderBy: { ordem: "asc" } });
  return banners.map(paraBannerAdmin);
}

export async function getBanner(id: string): Promise<BannerAdmin | null> {
  const banner = await prisma.banner.findUnique({ where: { id } });
  return banner ? paraBannerAdmin(banner) : null;
}

// O destino é interpolado no href do slide e a cor/imagem entram no `style` do
// mesmo elemento: os três são validados aqui, não só no formulário.
function destinoValido(ctaHref: string) {
  return ctaHref.startsWith("/") && !ctaHref.startsWith("//");
}

function limpar(dados: DadosBanner, exigirObrigatorios: boolean) {
  const data: {
    titulo?: string;
    eyebrow?: string;
    precoTexto?: string;
    ctaHref?: string;
    imagemUrl?: string | null;
    corFundo?: string;
    ativo?: boolean;
  } = {};

  if (dados.titulo !== undefined || exigirObrigatorios) {
    const titulo = dados.titulo?.trim() ?? "";
    if (!titulo) throw new ErroDeNegocio("Informe o título do banner.");
    data.titulo = titulo;
  }

  if (dados.ctaHref !== undefined || exigirObrigatorios) {
    const ctaHref = dados.ctaHref?.trim() ?? "";
    if (!ctaHref) throw new ErroDeNegocio("Informe o link de destino do banner.");
    if (!destinoValido(ctaHref)) {
      throw new ErroDeNegocio("O link de destino tem que ser um caminho da loja, começando com /.");
    }
    data.ctaHref = ctaHref;
  }

  if (dados.eyebrow !== undefined) data.eyebrow = dados.eyebrow.trim();
  if (dados.precoTexto !== undefined) data.precoTexto = dados.precoTexto.trim();
  if (dados.ativo !== undefined) data.ativo = !!dados.ativo;

  if (dados.corFundo !== undefined) {
    const corFundo = dados.corFundo?.trim() || COR_PADRAO;
    if (!COR_VALIDA.test(corFundo)) {
      throw new ErroDeNegocio("Cor de fundo inválida: use o formato #RRGGBB.");
    }
    data.corFundo = corFundo;
  }

  if (dados.imagemUrl !== undefined) {
    const imagemUrl = dados.imagemUrl?.trim() || null;
    if (imagemUrl && !ehUrlDeImagem(imagemUrl)) {
      throw new ErroDeNegocio("Imagem inválida: envie o arquivo pelo próprio formulário.");
    }
    data.imagemUrl = imagemUrl;
  }

  return data;
}

export async function criarBanner(dados: DadosBanner): Promise<BannerAdmin> {
  const data = limpar(dados, true);

  // Banner novo entra no fim do carrossel; a ordem se ajusta em /admin/banners.
  const ultimo = await prisma.banner.aggregate({ _max: { ordem: true } });

  const banner = await prisma.banner.create({
    data: {
      titulo: data.titulo!,
      ctaHref: data.ctaHref!,
      eyebrow: data.eyebrow ?? "",
      precoTexto: data.precoTexto ?? "",
      imagemUrl: data.imagemUrl ?? null,
      corFundo: data.corFundo ?? COR_PADRAO,
      ativo: data.ativo ?? true,
      ordem: (ultimo._max.ordem ?? -1) + 1,
    },
  });
  return paraBannerAdmin(banner);
}

export async function atualizarBanner(id: string, dados: DadosBanner): Promise<BannerAdmin> {
  const atual = await prisma.banner.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Banner não encontrado.", 404);

  const banner = await prisma.banner.update({ where: { id }, data: limpar(dados, false) });
  return paraBannerAdmin(banner);
}

// A tela manda o carrossel inteiro na ordem nova: numerar de uma vez evita
// ficar com duas posições iguais se uma das gravações falhar no meio.
export async function reordenarBanners(ids: string[]) {
  const existentes = await prisma.banner.findMany({ select: { id: true } });
  const conhecidos = new Set(existentes.map((b) => b.id));

  if (ids.length !== conhecidos.size || ids.some((id) => !conhecidos.has(id))) {
    throw new ErroDeNegocio("A ordem enviada não bate com os banners cadastrados.", 409);
  }

  await prisma.$transaction(
    ids.map((id, ordem) => prisma.banner.update({ where: { id }, data: { ordem } }))
  );
}

export async function removerBanner(id: string) {
  const atual = await prisma.banner.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Banner não encontrado.", 404);

  await prisma.banner.delete({ where: { id } });
}
