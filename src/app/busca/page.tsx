import ProductCard from "@/components/ProductCard";
import { produtos } from "@/lib/mock-data";

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const termo = q.trim().toLowerCase();

  const resultados = termo
    ? produtos.filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          p.categoriaLabel.toLowerCase().includes(termo) ||
          p.descricao.toLowerCase().includes(termo)
      )
    : produtos;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-display text-2xl mb-1">
        {termo ? `Resultados para "${q}"` : "Todos os produtos"}
      </h1>
      <p className="text-ink/50 text-sm mb-8">{resultados.length} produto(s) encontrado(s)</p>

      {resultados.length === 0 ? (
        <p className="text-ink/60">Nada encontrado. Tente outro termo.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {resultados.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      )}
    </div>
  );
}
