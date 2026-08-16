import Link from "next/link";
import HomeTopBar from "@/components/HomeTopBar";
import PromoBanner from "@/components/PromoBanner";
import QuickLinks from "@/components/QuickLinks";
import ProductShelf from "@/components/ProductShelf";
import { categorias, produtos } from "@/lib/mock-data";

export default function Home() {
  const destaques = produtos.filter((p) => p.destaque);
  const todos = produtos;

  return (
    <div>
      <HomeTopBar />

      <div className="-mt-4">
        <PromoBanner />
      </div>

      <QuickLinks />

      <ProductShelf
        titulo="Pode te interessar"
        subtitulo="Preço menor que na Shopee"
        produtos={destaques}
      />

      <ProductShelf titulo="Todos os produtos" produtos={todos} />

      <section className="mx-auto max-w-6xl px-5 py-8">
        <h2 className="font-display text-xl mb-4">Categorias</h2>
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
    </div>
  );
}
