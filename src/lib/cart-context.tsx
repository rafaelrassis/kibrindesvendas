"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getProduto } from "./mock-data";

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ItemCarrinho | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setItem(JSON.parse(raw));
      } catch {
        // ignora item mock inválido
      }
    }
  }, []);

  const persist = useCallback((next: ItemCarrinho | null) => {
    setItem(next);
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const iniciarItem = useCallback(
    (produtoId: string, variacoesEscolhidas: Record<string, string>) => {
      persist({ produtoId, variacoesEscolhidas });
    },
    [persist]
  );

  const definirPersonalizacao = useCallback(
    (p: ItemCarrinho["personalizacao"]) => {
      setItem((prev) => {
        if (!prev) return prev;
        const next = { ...prev, personalizacao: p };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
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
