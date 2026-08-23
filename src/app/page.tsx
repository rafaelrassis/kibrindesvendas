import PromoBanner from "@/components/PromoBanner";
import ProductShelf from "@/components/ProductShelf";
import { getBannersAtivos } from "@/lib/data/banners";
import { getDestaques, getProdutosAgrupadosPorCategoria } from "@/lib/data/produtos";

// A home é prerenderizada no build. Sem isso, banner cadastrado ou produto
// editado em /admin só apareceria no próximo deploy — a página seguiria
// servindo o HTML gerado lá atrás.
export const revalidate = 60;

export default async function Home() {
  const [destaques, grupos, banners] = await Promise.all([
    getDestaques(),
    getProdutosAgrupadosPorCategoria(5),
    getBannersAtivos(),
  ]);

  return (
    <div>

      <div className="-mt-4">
        <PromoBanner banners={banners} />
      </div>

      <ProductShelf
        titulo="Pode te interessar"
        produtos={destaques}
      />

      {grupos.map((g) => (
        <ProductShelf
          key={g.categoria.slug}
          titulo={g.categoria.label}
          produtos={g.produtos}
          href={`/categoria/${g.categoria.slug}`}
        />
      ))}
    </div>
  );
}
