"use client";

import { Bell } from "lucide-react";
import type { Produto } from "@/lib/types";
import { useFavoritos } from "@/lib/favoritos-context";

// Produto esgotado: "avisar" é favoritar — quem tem o produto nos favoritos
// recebe notificação e e-mail quando ele volta (lib/data/favoritos-estoque.ts).
export default function AvisarQuandoVoltar({ produto }: { produto: Produto }) {
  const { ehFavorito, alternarFavorito } = useFavoritos();
  const avisar = ehFavorito(produto.id);

  return (
    <button
      type="button"
      onClick={() => alternarFavorito(produto)}
      aria-pressed={avisar}
      className={`mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
        avisar ? "border-berry text-berry" : "border-line text-ink hover:border-berry"
      }`}
    >
      <Bell size={16} fill={avisar ? "currentColor" : "none"} />
      {avisar ? "Você será avisado — cancelar" : "Avisar quando voltar"}
    </button>
  );
}
