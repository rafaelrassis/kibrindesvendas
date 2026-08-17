import "server-only";
import { prisma } from "@/lib/prisma";
import type { Categoria } from "@/lib/types";

export async function getCategorias(): Promise<Categoria[]> {
  const categorias = await prisma.categoria.findMany({ orderBy: { label: "asc" } });
  return categorias.map((c) => ({ slug: c.slug, label: c.label, emoji: c.emoji }));
}
