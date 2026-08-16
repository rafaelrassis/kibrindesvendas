"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getProduto } from "./mock-data";
import { criarStoreLocal } from "./store-local";

export type ViaPersonalizacao = "IA" | "UPLOAD" | "MANUAL";

export type ItemCarrinho = {
  produtoId: string;
  variacoesEscolhidas: Record<string, string>;
  personalizacao?: {
    via: ViaPersonalizacao;
    resumo: string;
    aceite: boolean;
    aceiteEm?: string;
  };
};

type CartContextType = {
  item: ItemCarrinho | null;
  iniciarItem: (produtoId: string, variacoesEscolhidas: Record<string, string>) => void;
  definirPersonalizacao: (p: ItemCarrinho["personalizacao"]) => void;
  limpar: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "kibrindes-mock-item";

const store = criarStoreLocal<ItemCarrinho | null>(STORAGE_KEY, (bruto) => {
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as ItemCarrinho;
  } catch {
    return null; // ignora item mock inválido
  }
});

export function CartProvider({ children }: { children: ReactNode }) {
  const item = useSyncExternalStore(
    store.inscrever,
    store.ler,
    store.lerNoServidor
  );

  const persist = useCallback((next: ItemCarrinho | null) => {
    store.escrever(next ? JSON.stringify(next) : null);
  }, []);

  const iniciarItem = useCallback(
    (produtoId: string, variacoesEscolhidas: Record<string, string>) => {
      persist({ produtoId, variacoesEscolhidas });
    },
    [persist]
  );

  const definirPersonalizacao = useCallback(
    (p: ItemCarrinho["personalizacao"]) => {
      const atual = store.ler();
      if (!atual) return;
      persist({ ...atual, personalizacao: p });
    },
    [persist]
  );

  const limpar = useCallback(() => persist(null), [persist]);

  const value = useMemo(
    () => ({ item, iniciarItem, definirPersonalizacao, limpar }),
    [item, iniciarItem, definirPersonalizacao, limpar]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de CartProvider");
  return ctx;
}

export function useCartProduto() {
  const { item } = useCart();
  return item ? getProduto(item.produtoId) : undefined;
}
