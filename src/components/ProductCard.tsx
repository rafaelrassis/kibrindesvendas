import Link from "next/link";
import type { Produto } from "@/lib/mock-data";
import { compararPreco } from "@/lib/compare-price";

export default function ProductCard({ produto }: { produto: Produto }) {
  const comparacao = compararPreco(produto.precoShopee, produto.preco);

  return (
    <Link
      href={`/produto/${produto.id}`}
      className="group block tag-shape tag-hole bg-white border border-line pt-7 pb-5 px-4 hover:-translate-y-0.5 hover:shadow-md transition-all"
    >
      <div
        className="w-full aspect-square rounded-sm flex items-center justify-center text-5xl mb-4"
        style={{ backgroundColor: `${produto.cor}22` }}
      >
        <span>{produto.emoji}</span>
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

      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-base font-medium">
          R$ {produto.preco.toFixed(2).replace(".", ",")}
        </span>
        {comparacao.mostrar && (
          <>
            <span className="text-xs text-ink/40 line-through">
              R$ {produto.precoShopee.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-xs text-berry">-{comparacao.percentual}%</span>
          </>
        )}
      </div>
    </Link>
  );
}
