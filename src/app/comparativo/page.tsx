import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProdutos } from "@/lib/data/produtos";
import type { Produto } from "@/lib/types";
import { compararPreco, formatarPreco } from "@/lib/compare-price";

export const metadata: Metadata = {
  title: "Mesmo produto, preço menor no site — LeoKibrindes",
  description:
    "Compare os preços da Shopee com os do site oficial da LeoKibrindes e veja quanto você economiza comprando direto aqui.",
};

function economiaDe(produto: Produto) {
  return produto.precoShopee - produto.preco;
}

export default async function ComparativoPage() {
  const produtos = await getProdutos();
  const maisBaratos = produtos
    .filter((p) => compararPreco(p.precoShopee, p.preco).mostrar)
    .sort((a, b) => economiaDe(b) - economiaDe(a));

  const destaque = maisBaratos.find((p) => p.destaque) ?? maisBaratos[0];
  const comparacaoDestaque = destaque
    ? compararPreco(destaque.precoShopee, destaque.preco)
    : { mostrar: false as const };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-14">
      <section className="pt-8 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-block text-[11px] uppercase tracking-wide bg-mustard/20 text-pine-2 px-3 py-1 rounded-full">
            Site oficial
          </span>
          <Link
            href="/categorias"
            className="ml-auto bg-pine text-white text-sm font-medium px-5 py-2.5 rounded-full hover:brightness-110 transition"
          >
            Ver todos os produtos
          </Link>
        </div>

        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <h1 className="font-display text-3xl md:text-4xl">
            Mesmo produto, preço menor no site
          </h1>
          <a href="#produto" className="text-sm font-semibold text-pine hover:text-berry transition-colors">
            Ver comparação completa →
          </a>
        </div>

        <p className="max-w-[60ch] text-ink/70 mt-3">
          Vendemos na Shopee também — mas comprando direto aqui você paga menos
          pelo mesmo item, sem a taxa da plataforma.
        </p>
      </section>

      {/* 2 colunas no mobile (padrão das outras listagens); auto-fit no desktop, como no handoff */}
      <section className="grid grid-cols-2 gap-5 pb-10 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {maisBaratos.map((p) => (
          <ProductCard key={p.id} produto={p} comparativo />
        ))}
      </section>

      {destaque && (
        <>
          <hr className="border-line mb-10" />

          <section id="produto" className="grid md:grid-cols-2 gap-8 items-start scroll-mt-24">
            <div
              className="aspect-square rounded-lg flex items-center justify-center text-8xl"
              style={{ backgroundColor: `${destaque.cor}22` }}
            >
              {destaque.emoji}
            </div>

            <div>
              <span className="inline-block text-[11px] uppercase tracking-wide bg-mustard/20 text-pine-2 px-3 py-1 rounded-full">
                Mais vendido
              </span>
              <h2 className="font-display text-3xl mt-3 mb-2">{destaque.nome}</h2>
              <p className="max-w-[48ch] text-ink/70">
                {destaque.descricao} Mesma peça vendida na Shopee — aqui, sem
                taxa de marketplace.
              </p>

              <div className="bg-white border border-line rounded-lg shadow-sm p-5 mt-6">
                <p className="text-xs uppercase tracking-wide text-ink/50 mb-3">
                  Comparação de preço
                </p>

                <div className="flex flex-wrap gap-5">
                  <div className="flex-1 min-w-[160px] bg-paper-2 rounded-lg p-4">
                    <p className="text-[13px] font-semibold text-ink/60">Na Shopee</p>
                    <p className="font-display text-2xl text-ink/60 line-through">
                      {formatarPreco(destaque.precoShopee)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-[160px] bg-berry/10 border-2 border-berry rounded-lg p-4">
                    <p className="text-[13px] font-bold text-berry">Aqui no site</p>
                    <p className="font-display text-2xl text-berry">
                      {formatarPreco(destaque.preco)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 mt-4">
                  {comparacaoDestaque.mostrar && (
                    <span className="text-sm font-medium bg-mustard/20 text-pine-2 px-3 py-1 rounded-full">
                      Economize {formatarPreco(comparacaoDestaque.economia)} (
                      {comparacaoDestaque.percentual}%)
                    </span>
                  )}
                  <Link
                    href={`/produto/${destaque.id}`}
                    className="bg-pine text-white font-medium px-6 py-3 rounded-full hover:brightness-110 transition"
                  >
                    Comprar no site
                  </Link>
                </div>
              </div>

              <p className="text-[13px] text-ink/50 mt-4">
                *Preços de referência, sujeitos a variação. Mesmo produto, mesma
                qualidade — a diferença é só a taxa da plataforma.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
