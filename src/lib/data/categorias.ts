import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { ehUrlDeImagem } from "@/lib/imagens";
import type { Categoria } from "@/lib/types";
import { ErroDeNegocio } from "./erros";

export async function getCategorias(): Promise<Categoria[]> {
  const categorias = await prisma.categoria.findMany({ orderBy: { label: "asc" } });
  return categorias.map((c) => ({ slug: c.slug, label: c.label, imagemUrl: c.imagemUrl }));
}

// A imagem só é aceita se vier do nosso próprio upload (/api/admin/imagens) —
// nunca um endereço digitado. Vazio/ausente é válido: cai no ícone padrão.
function validarImagem(imagemUrl?: string | null) {
  const valor = imagemUrl?.trim() || null;
  if (valor && !ehUrlDeImagem(valor)) {
    throw new ErroDeNegocio("Imagem inválida — envie pelo campo de upload.");
  }
  return valor;
}

export async function criarCategoria(label: string, imagemUrl?: string | null): Promise<Categoria> {
  const slug = slugify(label);
  if (!slug) throw new ErroDeNegocio("Informe um nome válido para a categoria.");

  const jaExiste = await prisma.categoria.findUnique({ where: { slug } });
  if (jaExiste) throw new ErroDeNegocio("Já existe uma categoria com esse nome.", 409);

  const categoria = await prisma.categoria.create({
    data: { slug, label: label.trim(), imagemUrl: validarImagem(imagemUrl) },
  });
  return { slug: categoria.slug, label: categoria.label, imagemUrl: categoria.imagemUrl };
}

export async function atualizarCategoria(
  slug: string,
  label: string,
  imagemUrl?: string | null
): Promise<Categoria> {
  const atual = await prisma.categoria.findUnique({ where: { slug } });
  if (!atual) throw new ErroDeNegocio("Categoria não encontrada.", 404);

  // O slug é a chave usada nas URLs do catálogo, então renomear a categoria
  // muda só o rótulo — trocar o slug quebraria links já compartilhados.
  const categoria = await prisma.categoria.update({
    where: { slug },
    data: { label: label.trim(), imagemUrl: validarImagem(imagemUrl) },
  });
  return { slug: categoria.slug, label: categoria.label, imagemUrl: categoria.imagemUrl };
}

export async function removerCategoria(slug: string) {
  const atual = await prisma.categoria.findUnique({ where: { slug } });
  if (!atual) throw new ErroDeNegocio("Categoria não encontrada.", 404);

  const emUso = await prisma.produto.count({ where: { categoriaId: atual.id } });
  if (emUso > 0) {
    throw new ErroDeNegocio(
      `Não é possível remover: ${emUso} produto(s) usam essa categoria.`,
      409
    );
  }

  await prisma.categoria.delete({ where: { slug } });
}
