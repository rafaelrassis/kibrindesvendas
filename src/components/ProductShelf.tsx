import type { Produto } from "@/lib/mock-data";
import Link from "next/link";

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
          const desconto = Math.round(
            ((p.precoShopee - p.preco) / p.precoShopee) * 100
          );
          return (
            <Link
              key={p.id}
              href={`/produto/${p.id}`}
              className="snap-start shrink-0 w-36 bg-white border border-line rounded-lg p-3 hover:shadow-md transition-shadow"
            >
              <div
                className="w-full aspect-square rounded flex items-center justify-center text-4xl mb-2"
                style={{ backgroundColor: `${p.cor}22` }}
              >
                {p.emoji}
              </div>
              <p className="text-xs leading-snug line-clamp-2 mb-1 h-8">{p.nome}</p>
              <p className="font-mono text-sm font-medium">
                R$ {p.preco.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-[11px] text-berry">-{desconto}% vs Shopee</p>
            </Link>
          );
        })}
        <div className="shrink-0 w-2" />
      </div>
    </section>
  );
}
