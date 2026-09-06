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
import {
  perfilPadrao,
  preferenciasPadrao,
  type Endereco,
  type Perfil,
  type Preferencias,
} from "./conta-data";

type ContaContextType = {
  perfil: Perfil;
  enderecos: Endereco[];
  preferencias: Preferencias;
  carregando: boolean;
  atualizarPerfil: (dados: Perfil) => Promise<void>;
  salvarEndereco: (endereco: Endereco) => Promise<void>;
  removerEndereco: (id: string) => Promise<void>;
  definirEnderecoPadrao: (id: string) => Promise<void>;
  atualizarPreferencias: (dados: Preferencias) => Promise<void>;
};

const ContaContext = createContext<ContaContextType | null>(null);

// Tudo aqui é espelho do banco (Usuario + Endereco), por usuário logado —
// nada de localStorage: dado salvo no celular precisa aparecer no desktop.
// Visitante sem sessão só vê os valores padrão; as APIs recusam escrita com
// 401 e as telas de conta já exigem login antes de chegar aqui.
export function ContaProvider({ children }: { children: ReactNode }) {
  const { logado } = useAuth();
  const [perfil, setPerfil] = useState<Perfil>(perfilPadrao);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [preferencias, setPreferencias] = useState<Preferencias>(preferenciasPadrao);
  const [carregando, setCarregando] = useState(logado);

  // Logout limpa o estado local: ajuste de estado derivado de `logado`, feito
  // durante o próprio render (não é sincronização com sistema externo, então
  // não é trabalho de efeito — ver "Adjusting state when a prop changes" nos
  // docs do React).
  const [logadoAnterior, setLogadoAnterior] = useState(logado);
  if (logado !== logadoAnterior) {
    setLogadoAnterior(logado);
    if (!logado) {
      setPerfil(perfilPadrao);
      setEnderecos([]);
      setPreferencias(preferenciasPadrao);
      setCarregando(false);
    } else {
      setCarregando(true);
    }
  }

  // Login busca os três recursos do usuário no banco — isso sim é
  // sincronização com sistema externo, então fica no efeito.
  useEffect(() => {
    if (!logado) return;
    let ativo = true;

    Promise.all([
      fetch("/api/conta/perfil").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/conta/enderecos").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/conta/preferencias").then((r) => (r.ok ? r.json() : preferenciasPadrao)),
    ])
      .then(([p, e, pref]) => {
        if (!ativo) return;
        if (p) setPerfil(p);
        setEnderecos(Array.isArray(e) ? e : []);
        setPreferencias(pref ?? preferenciasPadrao);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [logado]);

  const atualizarPerfil = useCallback(async (dados: Perfil) => {
    const r = await fetch("/api/conta/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      throw new Error(corpo?.error ?? "Não foi possível salvar.");
    }
    setPerfil(await r.json());
  }, []);

  const salvarEndereco = useCallback(async (endereco: Endereco) => {
    const novo = !endereco.id || !enderecos.some((e) => e.id === endereco.id);
    const url = novo ? "/api/conta/enderecos" : `/api/conta/enderecos/${endereco.id}`;
    const r = await fetch(url, {
      method: novo ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(endereco),
    });
    if (!r.ok) throw new Error((await r.json()).error ?? "Não foi possível salvar o endereço.");
    const salvo: Endereco = await r.json();

    setEnderecos((atual) => {
      const semEndereco = atual.filter((e) => e.id !== salvo.id);
      const lista = [...semEndereco, salvo];
      // Espelha no client a mesma regra do servidor: só um padrão por vez.
      return salvo.padrao ? lista.map((e) => ({ ...e, padrao: e.id === salvo.id })) : lista;
    });
  }, [enderecos]);

  const removerEndereco = useCallback(async (id: string) => {
    const r = await fetch(`/api/conta/enderecos/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error("Não foi possível excluir o endereço.");
    setEnderecos((atual) => atual.filter((e) => e.id !== id));
    // Busca de novo pra refletir o novo padrão escolhido pelo servidor,
    // se o endereço removido era o padrão.
    const lista: Endereco[] = await fetch("/api/conta/enderecos").then((res) => res.json());
    setEnderecos(Array.isArray(lista) ? lista : []);
  }, []);

  const definirEnderecoPadrao = useCallback(async (id: string) => {
    const r = await fetch(`/api/conta/enderecos/${id}/padrao`, { method: "POST" });
    if (!r.ok) throw new Error("Não foi possível definir o endereço padrão.");
    setEnderecos((atual) => atual.map((e) => ({ ...e, padrao: e.id === id })));
  }, []);

  const atualizarPreferencias = useCallback(async (dados: Preferencias) => {
    const r = await fetch("/api/conta/preferencias", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    if (!r.ok) throw new Error("Não foi possível salvar as preferências.");
    setPreferencias(await r.json());
  }, []);

  const value = useMemo(
    () => ({
      perfil,
      enderecos,
      preferencias,
      carregando,
      atualizarPerfil,
      salvarEndereco,
      removerEndereco,
      definirEnderecoPadrao,
      atualizarPreferencias,
    }),
    [
      perfil,
      enderecos,
      preferencias,
      carregando,
      atualizarPerfil,
      salvarEndereco,
      removerEndereco,
      definirEnderecoPadrao,
      atualizarPreferencias,
    ]
  );

  return <ContaContext.Provider value={value}>{children}</ContaContext.Provider>;
}

export function useConta() {
  const ctx = useContext(ContaContext);
  if (!ctx) throw new Error("useConta precisa estar dentro de ContaProvider");
  return ctx;
}
