import Link from "next/link";
import { categorias } from "@/lib/mock-data";

export default function CategoriasPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="font-display text-2xl mb-6">Categorias</h1>
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
    </div>
  );
}
