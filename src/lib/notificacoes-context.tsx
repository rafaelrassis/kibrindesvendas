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
import { useAuth } from "./auth-context";

export type Notificacao = {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
};

type NotificacoesContextType = {
  notificacoes: Notificacao[];
  naoLidas: number;
  carregando: boolean;
  marcarLida: (id: string) => void;
};

const NotificacoesContext = createContext<NotificacoesContextType | null>(null);

// Mesmo desenho do favoritos-context: a resposta carrega de quem ela é, e
// "carregando" sai disso.
type Resposta = { usuarioId: string; lista: Notificacao[] };

const NENHUMA: Notificacao[] = [];

function buscarNotificacoes(): Promise<Notificacao[]> {
  return fetch("/api/notificacoes")
    .then((r) => (r.ok ? (r.json() as Promise<Notificacao[]>) : NENHUMA))
    .catch(() => NENHUMA);
}

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const { usuario, carregando: carregandoSessao } = useAuth();
  const usuarioId = usuario?.id ?? null;

  // O sininho do cabeçalho e a tela /notificacoes leem daqui, então marcar
  // como lida na tela apaga o contador de cima sem outra requisição.
  const [resposta, setResposta] = useState<Resposta | undefined>(undefined);

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    buscarNotificacoes().then((lista) => {
      if (ativo) setResposta({ usuarioId, lista });
    });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const lista =
    usuarioId === null
      ? NENHUMA
      : resposta?.usuarioId === usuarioId
        ? resposta.lista
        : undefined;

  const marcarLida = useCallback(
    (id: string) => {
      if (!usuarioId || !lista) return;

      setResposta({
        usuarioId,
        lista: lista.map((n) => (n.id === id ? { ...n, lida: true } : n)),
      });

      // Marcar como lida é detalhe visual: se falhar, o pior que acontece é o
      // aviso voltar a aparecer como novo no próximo carregamento.
      fetch(`/api/notificacoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lida: true }),
      }).catch(() => {});
    },
    [usuarioId, lista]
  );

  const value = useMemo(
    () => ({
      notificacoes: lista ?? NENHUMA,
      naoLidas: (lista ?? NENHUMA).filter((n) => !n.lida).length,
      carregando: carregandoSessao || lista === undefined,
      marcarLida,
    }),
    [lista, carregandoSessao, marcarLida]
  );

  return (
    <NotificacoesContext.Provider value={value}>{children}</NotificacoesContext.Provider>
  );
}

export function useNotificacoes() {
  const ctx = useContext(NotificacoesContext);
  if (!ctx) throw new Error("useNotificacoes precisa estar dentro de NotificacoesProvider");
  return ctx;
}
