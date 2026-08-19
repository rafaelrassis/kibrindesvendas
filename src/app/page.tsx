import Link from "next/link";
import PromoBanner from "@/components/PromoBanner";
import QuickLinks from "@/components/QuickLinks";
import ProductShelf from "@/components/ProductShelf";
import { getBannersAtivos } from "@/lib/data/banners";
import { getCategorias } from "@/lib/data/categorias";
import { getProdutos, getDestaques } from "@/lib/data/produtos";

// A home é prerenderizada no build. Sem isso, banner cadastrado ou produto
// editado em /admin só apareceria no próximo deploy — a página seguiria
// servindo o HTML gerado lá atrás.
export const revalidate = 60;

export default async function Home() {
  const [destaques, todos, categorias, banners] = await Promise.all([
    getDestaques(),
    getProdutos(),
    getCategorias(),
    getBannersAtivos(),
  ]);

  return (
    <div>

      <div className="-mt-4">
        <PromoBanner banners={banners} />
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
              {c.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imagemUrl}
                  alt=""
                  className="w-14 h-14 mx-auto mb-2 rounded object-cover"
                />
              ) : (
                <div className="text-3xl mb-2">🎁</div>
              )}
              <p className="text-sm font-medium">{c.label}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
