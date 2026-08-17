"use client";

import { Heart } from "lucide-react";
import { useFavoritos } from "@/lib/favoritos-context";

export default function FavoritoButton({
  produtoId,
  tamanho = "sm",
  className = "",
}: {
  produtoId: string;
  tamanho?: "sm" | "lg";
  className?: string;
}) {
  const { ehFavorito, alternarFavorito } = useFavoritos();
  const ativo = ehFavorito(produtoId);
  const grande = tamanho === "lg";

  return (
    <button
      type="button"
      onClick={() => alternarFavorito(produtoId)}
      aria-pressed={ativo}
      aria-label={ativo ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={`rounded-full bg-white shadow flex items-center justify-center transition-colors ${
        grande ? "w-10 h-10" : "w-8 h-8"
      } ${ativo ? "text-berry" : "text-ink/40 hover:text-berry"} ${className}`}
    >
      <Heart
        size={grande ? 20 : 16}
        fill={ativo ? "currentColor" : "none"}
      />
    </button>
  );
}
