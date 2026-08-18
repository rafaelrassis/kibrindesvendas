"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useProduto } from "./use-produto";
import { criarStoreLocal } from "./store-local";

export type ViaPersonalizacao = "IA" | "UPLOAD" | "MANUAL";

export type ItemCarrinho = {
  produtoId: string;
  variacoesEscolhidas: Record<string, string>;
  // Quantas unidades do produto. Entra no peso total cotado no frete e no
  // subtotal — sempre inteiro e no mínimo 1.
  quantidade: number;
  // CEP que o cliente já digitou na página do produto, se algum — o
  // checkout começa com ele preenchido em vez de pedir de novo.
  cepInformado?: string;
  personalizacao?: {
    via: ViaPersonalizacao;
    resumo: string;
    aceite: boolean;
    aceiteEm?: string;
    arteUrl?: string;
  };
};

type CartContextType = {
  item: ItemCarrinho | null;
  iniciarItem: (
    produtoId: string,
    variacoesEscolhidas: Record<string, string>,
    cepInformado?: string
  ) => void;
  definirPersonalizacao: (p: ItemCarrinho["personalizacao"]) => void;
  // Sempre arredonda pra inteiro e trava em 1 como piso — não existe pedido
  // de 0 ou fração de unidade.
  definirQuantidade: (quantidade: number) => void;
  limpar: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "kibrindes-mock-item";

const store = criarStoreLocal<ItemCarrinho | null>(STORAGE_KEY, (bruto) => {
  if (!bruto) return null;
  try {
    const item = JSON.parse(bruto) as ItemCarrinho;
    // Item salvo antes da quantidade existir (localStorage de sessão
    // anterior) não tem o campo — assume 1 em vez de virar NaN no cálculo.
    return { ...item, quantidade: item.quantidade ?? 1 };
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
    (produtoId: string, variacoesEscolhidas: Record<string, string>, cepInformado?: string) => {
      persist({
        produtoId,
        variacoesEscolhidas,
        quantidade: 1,
        ...(cepInformado && { cepInformado }),
      });
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

  const definirQuantidade = useCallback(
    (quantidade: number) => {
      const atual = store.ler();
      if (!atual) return;
      const inteira = Math.max(1, Math.round(quantidade) || 1);
      persist({ ...atual, quantidade: inteira });
    },
    [persist]
  );

  const limpar = useCallback(() => persist(null), [persist]);

  const value = useMemo(
    () => ({ item, iniciarItem, definirPersonalizacao, definirQuantidade, limpar }),
    [item, iniciarItem, definirPersonalizacao, definirQuantidade, limpar]
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
  const { produto } = useProduto(item?.produtoId);
  return item ? produto : undefined;
}
