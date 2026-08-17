"use client";

import { Heart } from "lucide-react";
import type { Produto } from "@/lib/types";
import { useFavoritos } from "@/lib/favoritos-context";

export default function FavoritoButton({
  produto,
  tamanho = "sm",
  className = "",
}: {
  // O produto inteiro (e não só o id) porque a lista de favoritos guarda os
  // produtos: com ele o coração já entra na lista antes da resposta do servidor.
  produto: Produto;
  tamanho?: "sm" | "lg";
  className?: string;
}) {
  const { ehFavorito, alternarFavorito } = useFavoritos();
  const ativo = ehFavorito(produto.id);
  const grande = tamanho === "lg";

  return (
    <button
      type="button"
      onClick={() => alternarFavorito(produto)}
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
