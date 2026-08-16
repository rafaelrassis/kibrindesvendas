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

type AuthContextType = {
  logado: boolean;
  nome: string;
  entrar: () => void;
  sair: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "kibrindes-mock-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    setLogado(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const entrar = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setLogado(true);
  }, []);

  const sair = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setLogado(false);
  }, []);

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
