import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { getCategorias } from "@/lib/data/categorias";
import { getProdutosPorCategoria } from "@/lib/data/produtos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categorias = await getCategorias();
  const categoria = categorias.find((c) => c.slug === slug);
  if (!categoria) return { title: "Categoria não encontrada — LeoKibrindes" };

  const titulo = `${categoria.label} — LeoKibrindes`;
  const descricao = `Presentes personalizados de ${categoria.label.toLowerCase()} na LeoKibrindes.`;
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `/categoria/${categoria.slug}` },
    openGraph: { title: titulo, description: descricao, type: "website" },
  };
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categorias = await getCategorias();
  const categoria = categorias.find((c) => c.slug === slug);
  if (!categoria) notFound();

  const lista = await getProdutosPorCategoria(slug);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Categoria</p>
      <h1 className="font-display text-3xl mb-1 flex items-center gap-3">
        {categoria.imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={categoria.imagemUrl} alt="" className="w-10 h-10 rounded object-cover" />
        ) : (
          <span>🎁</span>
        )}{" "}
        {categoria.label}
      </h1>
      <p className="text-ink/60 mb-8">{lista.length} produtos</p>

      {lista.length === 0 ? (
        <p className="text-ink/50">Nenhum produto nessa categoria ainda.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {lista.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      )}
    </div>
  );
}
