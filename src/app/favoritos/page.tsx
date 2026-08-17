"use client";

import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { useFavoritosProdutos } from "@/lib/favoritos-context";

export default function FavoritosPage() {
  const produtos = useFavoritosProdutos();

  if (produtos.length === 0) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-4xl mb-4">🤍</p>
        <h1 className="font-display text-2xl mb-2">Seus favoritos</h1>
        <p className="text-ink/60 text-sm mb-6">
          Você ainda não salvou nenhum produto. Toque no coração de um produto
          pra guardar ele aqui.
        </p>
        <Link
          href="/categorias"
          className="inline-block bg-pine text-white text-sm px-5 py-2.5 rounded-full hover:bg-pine-2 transition-colors"
        >
          Ver departamentos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Seus favoritos</h1>
      <p className="text-ink/60 mb-8">
        {produtos.length === 1
          ? "1 produto salvo"
          : `${produtos.length} produtos salvos`}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {produtos.map((p) => (
          <ProductCard key={p.id} produto={p} />
        ))}
      </div>
    </div>
  );
}
