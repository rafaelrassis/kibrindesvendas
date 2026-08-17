"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { criarStoreLocal } from "./store-local";
import { useProdutos } from "./use-produto";

type FavoritosContextType = {
  favoritos: string[];
  total: number;
  ehFavorito: (produtoId: string) => boolean;
  alternarFavorito: (produtoId: string) => void;
};

const FavoritosContext = createContext<FavoritosContextType | null>(null);

const STORAGE_KEY = "kibrindes-mock-favoritos";

const store = criarStoreLocal<string[]>(STORAGE_KEY, (bruto) => {
  if (!bruto) return [];
  try {
    const parsed = JSON.parse(bruto);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return []; // ignora lista mock inválida
  }
});

export function FavoritosProvider({ children }: { children: ReactNode }) {
  const favoritos = useSyncExternalStore(
    store.inscrever,
    store.ler,
    store.lerNoServidor
  );

  const alternarFavorito = useCallback((produtoId: string) => {
    // Lê direto da store: o clique pode vir de um card renderizado antes da
    // última mudança (outra aba, por exemplo).
    const atual = store.ler();
    const proximo = atual.includes(produtoId)
      ? atual.filter((id) => id !== produtoId)
      : [produtoId, ...atual]; // mais recentes primeiro
    store.escrever(JSON.stringify(proximo));
  }, []);

  const ehFavorito = useCallback(
    (produtoId: string) => favoritos.includes(produtoId),
    [favoritos]
  );

  const value = useMemo(
    () => ({
      favoritos,
      total: favoritos.length,
      ehFavorito,
      alternarFavorito,
    }),
    [favoritos, ehFavorito, alternarFavorito]
  );

  return (
    <FavoritosContext.Provider value={value}>
      {children}
    </FavoritosContext.Provider>
  );
}

export function useFavoritos() {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error("useFavoritos precisa estar dentro de FavoritosProvider");
  return ctx;
}

export function useFavoritosProdutos() {
  const { favoritos } = useFavoritos();
  const { produtos, carregando } = useProdutos();

  // Ignora ids que não existem mais no catálogo (produto saiu do ar) e mantém
  // a ordem da lista de favoritos: mais recentes primeiro.
  const salvos = useMemo(() => {
    const porId = new Map(produtos.map((p) => [p.id, p]));
    return favoritos.flatMap((id) => porId.get(id) ?? []);
  }, [favoritos, produtos]);

  return { produtos: salvos, carregando };
}
