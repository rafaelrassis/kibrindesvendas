import type { Produto } from "@/lib/types";
import Link from "next/link";
import { calcularDesconto, compararPreco, formatarPreco } from "@/lib/compare-price";

export default function ProductShelf({
  titulo,
  subtitulo,
  produtos,
}: {
  titulo: string;
  subtitulo?: string;
  produtos: Produto[];
}) {
  return (
    <section className="py-6">
      <div className="mx-auto max-w-6xl px-5 flex items-end justify-between mb-3">
        <h2 className="font-display text-xl">{titulo}</h2>
        {subtitulo && <p className="text-xs text-ink/50 hidden md:block">{subtitulo}</p>}
      </div>

      <div className="pl-5 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {produtos.map((p) => {
          const comparacao = compararPreco(p.precoShopee, p.preco, p.vendidoNaShopee);
          const desconto = calcularDesconto(p.preco, p.precoOriginal);
          return (
            <Link
              key={p.id}
              href={`/produto/${p.id}`}
              className="snap-start shrink-0 w-36 bg-white border border-line rounded-lg p-3 hover:shadow-md transition-shadow"
            >
              <div
                className="w-full aspect-square rounded flex items-center justify-center text-4xl mb-2 overflow-hidden"
                style={{ backgroundColor: `${p.cor}22` }}
              >
                {p.imagens[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagens[0]} alt={p.nome} className="w-full h-full object-cover" />
                ) : (
                  p.emoji
                )}
              </div>
              <p className="text-xs leading-snug line-clamp-2 mb-1 h-8">{p.nome}</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="font-mono text-sm font-medium">
                  R$ {p.preco.toFixed(2).replace(".", ",")}
                </p>
                {desconto.ativo && (
                  <p className="font-mono text-[11px] text-ink/40 line-through">
                    {formatarPreco(p.precoOriginal!)}
                  </p>
                )}
              </div>
              {desconto.ativo ? (
                <p className="text-[11px] text-berry font-medium">-{desconto.percentual}%</p>
              ) : (
                comparacao.mostrar && (
                  <p className="text-[11px] text-berry">
                    -{comparacao.percentual}% vs Shopee
                  </p>
                )
              )}
            </Link>
          );
        })}
        <div className="shrink-0 w-2" />
      </div>
    </section>
  );
}
