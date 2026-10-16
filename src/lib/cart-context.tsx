"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { criarStoreLocal } from "./store-local";
import { useAuth } from "./auth-context";

export type ViaPersonalizacao = "IA" | "UPLOAD" | "MANUAL";

export type ItemCarrinho = {
  // Id da linha, gerado no navegador. É o que identifica a linha pra mudar
  // quantidade, personalização ou remover — produto + variação não bastam,
  // porque o mesmo produto personalizado pode entrar mais de uma vez.
  id: string;
  produtoId: string;
  variacoesEscolhidas: Record<string, string>;
  // Quantas unidades do produto. Entra no peso total cotado no frete e no
  // subtotal — sempre inteiro e no mínimo 1.
  quantidade: number;
  // CEP que o cliente já digitou na página do produto, se algum — o
  // checkout começa com ele preenchido em vez de pedir de novo.
  cepInformado?: string;
  // Preço unitário visto ao adicionar; o carrinho avisa se o preço atual difere.
  precoAdicionado?: number;
  personalizacao?: {
    via: ViaPersonalizacao;
    resumo: string;
    aceite: boolean;
    aceiteEm?: string;
    arteUrl?: string;
  };
};

export type NovoItemCarrinho = {
  produtoId: string;
  variacoesEscolhidas: Record<string, string>;
  quantidade?: number;
  cepInformado?: string;
  precoAdicionado?: number;
  // Produto que exige personalização (1 arte por unidade) nunca se junta a
  // uma linha existente: cada adição é uma linha própria, com a sua arte.
  linhaUnica?: boolean;
};

type CartContextType = {
  itens: ItemCarrinho[];
  // Soma das quantidades — é o número do selo no ícone do carrinho.
  quantidadeTotal: number;
  // Mini-carrinho lateral (desktop). Aberto ao adicionar um item.
  drawerAberto: boolean;
  abrirDrawer: () => void;
  fecharDrawer: () => void;
  // Aceita o preço atual de uma linha (some o aviso de preço alterado).
  atualizarPreco: (itemId: string, preco: number) => void;
  // Devolve o id da linha afetada (a nova, ou a existente que ganhou unidades).
  adicionarItem: (novo: NovoItemCarrinho) => string;
  definirPersonalizacao: (itemId: string, p: ItemCarrinho["personalizacao"]) => void;
  // Sempre arredonda pra inteiro e trava em 1 como piso — não existe pedido
  // de 0 ou fração de unidade. Pra tirar a linha, use `removerItem`.
  definirQuantidade: (itemId: string, quantidade: number) => void;
  removerItem: (itemId: string) => void;
  limpar: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "kibrindes-carrinho";
// Chave da época em que o carrinho guardava 1 item só — migrada uma vez.
const STORAGE_KEY_LEGADO = "kibrindes-mock-item";

function novoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Contexto sem crypto.randomUUID (http fora de localhost): id curto basta,
    // só precisa ser único dentro do carrinho.
    return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function chaveVariacoes(v: Record<string, string>): string {
  return Object.keys(v)
    .sort()
    .map((k) => `${k}:${v[k]}`)
    .join("|");
}

// Duas linhas "iguais" (mesmo produto e mesmas variações, sem arte) viram uma
// só com a soma das quantidades.
function mesmaLinha(a: ItemCarrinho, b: Omit<ItemCarrinho, "id">): boolean {
  return (
    a.produtoId === b.produtoId &&
    !a.personalizacao &&
    !b.personalizacao &&
    chaveVariacoes(a.variacoesEscolhidas) === chaveVariacoes(b.variacoesEscolhidas)
  );
}

function normalizarItem(bruto: unknown, posicao: number): ItemCarrinho | null {
  if (!bruto || typeof bruto !== "object") return null;
  const item = bruto as Partial<ItemCarrinho>;
  if (typeof item.produtoId !== "string" || !item.produtoId) return null;
  return {
    ...(item as ItemCarrinho),
    id: typeof item.id === "string" && item.id ? item.id : `legado-${posicao}`,
    variacoesEscolhidas: item.variacoesEscolhidas ?? {},
    // Item salvo antes da quantidade existir não tem o campo — assume 1 em
    // vez de virar NaN no cálculo.
    quantidade: Math.max(1, Math.round(Number(item.quantidade)) || 1),
  };
}

const VAZIO: ItemCarrinho[] = [];

const store = criarStoreLocal<ItemCarrinho[]>(STORAGE_KEY, (bruto) => {
  if (!bruto) return VAZIO;
  try {
    const dados = JSON.parse(bruto);
    if (!Array.isArray(dados)) return VAZIO;
    return dados
      .map(normalizarItem)
      .filter((i): i is ItemCarrinho => i !== null);
  } catch {
    return VAZIO; // ignora carrinho inválido
  }
});

export function CartProvider({ children }: { children: ReactNode }) {
  const itens = useSyncExternalStore(store.inscrever, store.ler, store.lerNoServidor);

  const { usuario } = useAuth();
  const usuarioId = usuario?.id ?? null;

  const persist = useCallback((next: ItemCarrinho[]) => {
    store.escrever(next.length > 0 ? JSON.stringify(next) : null);
  }, []);

  // Espelha a mutação no banco pra quem está logado — best effort, sem
  // travar a UI: se a requisição falhar, a próxima mutação tenta de novo com
  // o estado mais atual. Visitante sem conta continua só no localStorage.
  const sincronizarServidor = useCallback(
    (next: ItemCarrinho[]) => {
      if (!usuarioId) return;
      if (next.length > 0) {
        fetch("/api/carrinho", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itens: next }),
        }).catch(() => {});
      } else {
        fetch("/api/carrinho", { method: "DELETE" }).catch(() => {});
      }
    },
    [usuarioId]
  );

  const aplicar = useCallback(
    (next: ItemCarrinho[]) => {
      persist(next);
      sincronizarServidor(next);
    },
    [persist, sincronizarServidor]
  );

  // Carrinho do tempo em que cabia 1 item só: vira uma lista de 1 linha, uma
  // vez, e a chave antiga some.
  useEffect(() => {
    try {
      const legado = window.localStorage.getItem(STORAGE_KEY_LEGADO);
      if (!legado) return;
      window.localStorage.removeItem(STORAGE_KEY_LEGADO);
      if (store.ler().length > 0) return;
      const item = normalizarItem({ ...JSON.parse(legado), id: novoId() }, 0);
      if (item) persist([item]);
    } catch {
      // legado ilegível: descarta
    }
  }, [persist]);

  // Sincroniza com o servidor uma vez por login (primeiro carregamento já
  // logado, ou troca de conta). O carrinho do banco é o que sobrevive a troca
  // de aparelho e a boleto que demora dias pra confirmar; o que o visitante
  // montou antes de entrar soma por cima, em vez de se perder no login.
  const sincronizadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!usuarioId || sincronizadoRef.current === usuarioId) return;
    sincronizadoRef.current = usuarioId;

    fetch("/api/carrinho")
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .then((doServidorBruto) => {
        const doServidor = (Array.isArray(doServidorBruto) ? doServidorBruto : [])
          .map(normalizarItem)
          .filter((i): i is ItemCarrinho => i !== null);
        const local = store.ler();

        const mesclado = [...doServidor];
        let mudouAlgoLocal = false;
        for (const linha of local) {
          if (mesclado.some((m) => m.id === linha.id)) continue;
          mudouAlgoLocal = true;
          const gemea = mesclado.findIndex((m) => mesmaLinha(m, linha));
          if (gemea >= 0) {
            mesclado[gemea] = {
              ...mesclado[gemea],
              quantidade: mesclado[gemea].quantidade + linha.quantidade,
            };
          } else {
            mesclado.push(linha);
          }
        }

        persist(mesclado);
        // Só sobe de volta quando o visitante trouxe algo que o banco não tinha.
        if (mudouAlgoLocal) sincronizarServidor(mesclado);
      })
      .catch(() => {});
  }, [usuarioId, persist, sincronizarServidor]);

  const adicionarItem = useCallback(
    (novo: NovoItemCarrinho): string => {
      const atuais = store.ler();
      const quantidade = Math.max(1, Math.round(Number(novo.quantidade)) || 1);
      const candidata: Omit<ItemCarrinho, "id"> = {
        produtoId: novo.produtoId,
        variacoesEscolhidas: novo.variacoesEscolhidas,
        quantidade,
        ...(novo.cepInformado && { cepInformado: novo.cepInformado }),
        ...(novo.precoAdicionado && { precoAdicionado: novo.precoAdicionado }),
      };

      const existente = novo.linhaUnica ? undefined : atuais.find((i) => mesmaLinha(i, candidata));
      if (existente) {
        aplicar(
          atuais.map((i) =>
            i.id === existente.id
              ? {
                  ...i,
                  quantidade: i.quantidade + quantidade,
                  ...(novo.cepInformado && { cepInformado: novo.cepInformado }),
                  ...(novo.precoAdicionado && { precoAdicionado: novo.precoAdicionado }),
                }
              : i
          )
        );
        return existente.id;
      }

      const id = novoId();
      aplicar([...atuais, { id, ...candidata }]);
      return id;
    },
    [aplicar]
  );

  const definirPersonalizacao = useCallback(
    (itemId: string, p: ItemCarrinho["personalizacao"]) => {
      const atuais = store.ler();
      if (!atuais.some((i) => i.id === itemId)) return;
      aplicar(atuais.map((i) => (i.id === itemId ? { ...i, personalizacao: p } : i)));
    },
    [aplicar]
  );

  const definirQuantidade = useCallback(
    (itemId: string, quantidade: number) => {
      const atuais = store.ler();
      if (!atuais.some((i) => i.id === itemId)) return;
      const inteira = Math.max(1, Math.round(quantidade) || 1);
      aplicar(atuais.map((i) => (i.id === itemId ? { ...i, quantidade: inteira } : i)));
    },
    [aplicar]
  );

  const atualizarPreco = useCallback(
    (itemId: string, preco: number) => {
      const atuais = store.ler();
      if (!atuais.some((i) => i.id === itemId)) return;
      aplicar(atuais.map((i) => (i.id === itemId ? { ...i, precoAdicionado: preco } : i)));
    },
    [aplicar]
  );

  const [drawerAberto, setDrawerAberto] = useState(false);
  const abrirDrawer = useCallback(() => setDrawerAberto(true), []);
  const fecharDrawer = useCallback(() => setDrawerAberto(false), []);

  const removerItem = useCallback(
    (itemId: string) => {
      const atuais = store.ler();
      const restantes = atuais.filter((i) => i.id !== itemId);
      if (restantes.length === atuais.length) return;
      aplicar(restantes);
    },
    [aplicar]
  );

  const limpar = useCallback(() => {
    aplicar([]);
  }, [aplicar]);

  const quantidadeTotal = useMemo(
    () => itens.reduce((soma, i) => soma + i.quantidade, 0),
    [itens]
  );

  const value = useMemo(
    () => ({
      itens,
      quantidadeTotal,
      drawerAberto,
      abrirDrawer,
      fecharDrawer,
      atualizarPreco,
      adicionarItem,
      definirPersonalizacao,
      definirQuantidade,
      removerItem,
      limpar,
    }),
    [
      itens,
      quantidadeTotal,
      drawerAberto,
      abrirDrawer,
      fecharDrawer,
      atualizarPreco,
      adicionarItem,
      definirPersonalizacao,
      definirQuantidade,
      removerItem,
      limpar,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de CartProvider");
  return ctx;
}
