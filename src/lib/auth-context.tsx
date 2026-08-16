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

type AuthContextType = {
  logado: boolean;
  nome: string;
  entrar: () => void;
  sair: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "kibrindes-mock-auth";

const store = criarStoreLocal(STORAGE_KEY, (bruto) => bruto === "1");

export function AuthProvider({ children }: { children: ReactNode }) {
  const logado = useSyncExternalStore(
    store.inscrever,
    store.ler,
    store.lerNoServidor
  );

  const entrar = useCallback(() => store.escrever("1"), []);

  const sair = useCallback(() => store.escrever(null), []);

  const value = useMemo(
    () => ({ logado, nome: "Cliente", entrar, sair }),
    [logado, entrar, sair]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
