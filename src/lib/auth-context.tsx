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

type Usuario = { id: string; nome: string; email: string; admin: boolean };

type AuthContextType = {
  logado: boolean;
  carregando: boolean;
  usuario: Usuario | null;
  nome: string;
  login: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  registrar: (
    nome: string,
    email: string,
    senha: string,
    cpf: string
  ) => Promise<{ ok: boolean; erro?: string }>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Só o servidor enxerga o cookie httpOnly, então a sessão é lida por fetch
  // no primeiro render. Nada de setState síncrono aqui: o estado inicial já é
  // "carregando".
  useEffect(() => {
    let cancelado = false;

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((u: Usuario | null) => {
        if (!cancelado) setUsuario(u);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, erro: data.error as string };
    setUsuario(data);
    return { ok: true };
  }, []);

  const registrar = useCallback(
    async (nome: string, email: string, senha: string, cpf: string) => {
      const r = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, cpf }),
      });
      const data = await r.json();
      if (!r.ok) return { ok: false, erro: data.error as string };
      setUsuario(data);
      return { ok: true };
    },
    []
  );

  const sair = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUsuario(null);
  }, []);

  const value = useMemo(
    () => ({
      logado: !!usuario,
      carregando,
      usuario,
      nome: usuario?.nome ?? "Cliente",
      login,
      registrar,
      sair,
    }),
    [usuario, carregando, login, registrar, sair]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
