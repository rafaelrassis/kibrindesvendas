import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import HeroCarousel from "@/components/HeroCarousel";
import { categorias, produtos } from "@/lib/mock-data";

export default function Home() {
  const destaques = produtos.filter((p) => p.destaque);

  return (
    <div>
      <HeroCarousel />

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-2xl">Categorias</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categorias.map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="bg-white border border-line rounded-lg p-5 text-center hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="text-3xl mb-2">{c.emoji}</div>
              <p className="text-sm font-medium">{c.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-2xl">Mais pedidos</h2>
          <p className="text-sm text-ink/50 hidden md:block">
            Preço menor que na Shopee — sem taxa de plataforma
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {destaques.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
