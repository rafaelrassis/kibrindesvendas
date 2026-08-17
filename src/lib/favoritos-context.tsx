"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Produto } from "@/lib/types";
import { useAuth } from "./auth-context";

type FavoritosContextType = {
  produtos: Produto[];
  total: number;
  carregando: boolean;
  ehFavorito: (produtoId: string) => boolean;
  alternarFavorito: (produto: Produto) => void;
};

const FavoritosContext = createContext<FavoritosContextType | null>(null);

// A resposta guarda de quem é a lista: assim "carregando" é derivado (a
// resposta ainda não é da sessão atual) em vez de virar mais um estado.
type Resposta = { usuarioId: string; produtos: Produto[] };

// Referência fixa: sem conta a lista é sempre a mesma lista vazia.
const NENHUM: Produto[] = [];

function buscarFavoritos(): Promise<Produto[]> {
  return fetch("/api/favoritos")
    .then((r) => (r.ok ? (r.json() as Promise<Produto[]>) : NENHUM))
    .catch(() => NENHUM);
}

export function FavoritosProvider({ children }: { children: ReactNode }) {
  const { usuario, carregando: carregandoSessao } = useAuth();
  const usuarioId = usuario?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();

  // Os favoritos agora moram no banco: a lista só existe depois da resposta.
  const [resposta, setResposta] = useState<Resposta | undefined>(undefined);

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    buscarFavoritos().then((produtos) => {
      if (ativo) setResposta({ usuarioId, produtos });
    });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const recarregar = useCallback((usuarioId: string) => {
    buscarFavoritos().then((produtos) => setResposta({ usuarioId, produtos }));
  }, []);

  // Sem sessão não há favoritos; com sessão, só vale a resposta daquela conta
  // (trocar de usuário zera a lista até a nova chegar).
  const produtos =
    usuarioId === null
      ? NENHUM
      : resposta?.usuarioId === usuarioId
        ? resposta.produtos
        : undefined;

  const ehFavorito = useCallback(
    (produtoId: string) => !!produtos?.some((p) => p.id === produtoId),
    [produtos]
  );

  const alternarFavorito = useCallback(
    (produto: Produto) => {
      if (!usuarioId) {
        router.push(`/entrar?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const salvo = !!produtos?.some((p) => p.id === produto.id);

      // Troca o coração na hora e confirma com o servidor depois; se a
      // requisição falhar, a lista volta pro que está gravado.
      setResposta({
        usuarioId,
        produtos: salvo
          ? (produtos ?? NENHUM).filter((p) => p.id !== produto.id)
          : [produto, ...(produtos ?? NENHUM)], // mais recentes primeiro
      });

      const requisicao = salvo
        ? fetch(`/api/favoritos/${produto.id}`, { method: "DELETE" })
        : fetch("/api/favoritos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ produtoId: produto.id }),
          });

      requisicao
        .then((r) => {
          if (!r.ok) recarregar(usuarioId);
        })
        .catch(() => recarregar(usuarioId));
    },
    [usuarioId, produtos, router, pathname, recarregar]
  );

  const value = useMemo(
    () => ({
      produtos: produtos ?? NENHUM,
      total: produtos?.length ?? 0,
      carregando: carregandoSessao || produtos === undefined,
      ehFavorito,
      alternarFavorito,
    }),
    [produtos, carregandoSessao, ehFavorito, alternarFavorito]
  );

  return <FavoritosContext.Provider value={value}>{children}</FavoritosContext.Provider>;
}

export function useFavoritos() {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error("useFavoritos precisa estar dentro de FavoritosProvider");
  return ctx;
}
