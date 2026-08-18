import Link from "next/link";
import type { Produto } from "@/lib/types";
import { compararPreco, formatarPreco } from "@/lib/compare-price";
import FavoritoButton from "./FavoritoButton";

export default function ProductCard({
  produto,
  comparativo = false,
}: {
  produto: Produto;
  comparativo?: boolean;
}) {
  const comparacao = compararPreco(produto.precoShopee, produto.preco, produto.vendidoNaShopee);

  return (
    // O favorito fica fora do <Link>: <button> dentro de <a> é HTML inválido e
    // o clique navegaria junto.
    <div className="group relative hover:-translate-y-0.5 transition-transform">
      <Link
        href={`/produto/${produto.id}`}
        className="block tag-shape tag-hole bg-white border border-line pt-7 pb-5 px-4 group-hover:shadow-md transition-shadow"
      >
        <div
          className="relative w-full aspect-square rounded-sm flex items-center justify-center text-5xl mb-4"
          style={{ backgroundColor: `${produto.cor}22` }}
        >
          <span>{produto.emoji}</span>
          {/* top-6: abaixo do corte diagonal do .tag-shape, senão a etiqueta fica cortada */}
          {comparativo && comparacao.mostrar && (
            <span className="absolute top-6 left-3 bg-berry text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
              Mais barato aqui
            </span>
          )}
        </div>

        <p className="text-xs uppercase tracking-wide text-ink/50 mb-1">
          {produto.categoriaLabel}
        </p>
        <h3 className="font-display text-lg leading-snug mb-1 group-hover:text-berry transition-colors">
          {produto.nome}
        </h3>

        {produto.requerPersonalizacao && (
          <span className="inline-block text-[11px] uppercase tracking-wide bg-mustard/20 text-pine-2 px-2 py-0.5 rounded-full mb-2">
            Personalizável
          </span>
        )}

        <div className="flex flex-wrap items-baseline gap-x-2 font-mono">
          <span className="text-base font-medium whitespace-nowrap">
            {formatarPreco(produto.preco)}
          </span>
          {comparacao.mostrar && (
            <>
              <span className="text-xs text-ink/40 line-through whitespace-nowrap">
                {formatarPreco(produto.precoShopee)}
              </span>
              {!comparativo && (
                <span className="text-xs text-berry">-{comparacao.percentual}%</span>
              )}
            </>
          )}
        </div>

        {comparativo && comparacao.mostrar && (
          <p className="text-[13px] font-semibold text-pine-2 mt-0.5">
            Economize {formatarPreco(comparacao.economia)}
          </p>
        )}

        <span className="mt-3 block text-center text-sm font-medium rounded-full bg-pine text-white py-2 group-hover:bg-pine-2 transition-colors">
          {produto.requerPersonalizacao ? "Personalizar" : "Ver detalhes"}
        </span>
      </Link>

      {/* top-10: abaixo do corte diagonal, senão o botão flutua fora do cartão */}
      <FavoritoButton produto={produto} className="absolute top-10 right-3 z-10" />
    </div>
  );
}
