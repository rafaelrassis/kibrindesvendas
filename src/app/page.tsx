import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { categorias, produtos } from "@/lib/mock-data";

export default function Home() {
  const destaques = produtos.filter((p) => p.destaque);

  return (
    <div>
      <section className="bg-pine text-paper">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <p className="uppercase tracking-[0.2em] text-xs text-mustard mb-4">
              Feito sob medida pra quem recebe
            </p>
            <h1 className="font-display text-4xl md:text-5xl leading-[1.05] mb-5">
              Cada presente começa com uma história.
              <br />
              A gente coloca ela no produto.
            </h1>
            <p className="text-paper/70 max-w-md mb-8">
              Ímãs, canecas, camisetas e moletons personalizados com a sua foto,
              sua arte ou uma ideia — e produtos prontos, sem enrolação.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/categoria/imas"
                className="bg-mustard text-pine font-medium px-6 py-3 rounded-full hover:brightness-95 transition"
              >
                Ver ímãs personalizados
              </Link>
              <Link
                href="/suporte"
                className="border border-paper/30 px-6 py-3 rounded-full hover:bg-paper/10 transition"
              >
                Como funciona
              </Link>
            </div>
          </div>
          <div className="tag-shape tag-hole bg-paper text-ink p-6 rotate-2 shadow-xl w-full max-w-xs mx-auto">
            <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Etiqueta de presente</p>
            <p className="font-display text-2xl mb-1">Pra: Vó Marlene</p>
            <p className="text-sm text-ink/60">Com carinho, da sua neta favorita 💛</p>
          </div>
        </div>
      </section>

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
