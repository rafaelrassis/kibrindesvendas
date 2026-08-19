import type { MetadataRoute } from "next";
import { getProdutos } from "@/lib/data/produtos";
import { getCategorias } from "@/lib/data/categorias";

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [produtos, categorias] = await Promise.all([getProdutos(), getCategorias()]);
  const base = baseUrl();

  const estaticas: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/categorias`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/busca`, changeFrequency: "weekly", priority: 0.3 },
  ];

  const paginasCategorias: MetadataRoute.Sitemap = categorias.map((c) => ({
    url: `${base}/categoria/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const paginasProdutos: MetadataRoute.Sitemap = produtos.map((p) => ({
    url: `${base}/produto/${p.id}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...estaticas, ...paginasCategorias, ...paginasProdutos];
}
