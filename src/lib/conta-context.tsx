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
import {
  perfilPadrao,
  preferenciasPadrao,
  type Endereco,
  type Perfil,
  type Preferencias,
} from "./conta-data";

type EstadoConta = {
  perfil: Perfil;
  enderecos: Endereco[];
  preferencias: Preferencias;
};

const estadoPadrao: EstadoConta = {
  perfil: perfilPadrao,
  enderecos: [],
  preferencias: preferenciasPadrao,
};

type ContaContextType = {
  perfil: Perfil;
  enderecos: Endereco[];
  preferencias: Preferencias;
  atualizarPerfil: (dados: Perfil) => void;
  salvarEndereco: (endereco: Endereco) => void;
  removerEndereco: (id: string) => void;
  definirEnderecoPadrao: (id: string) => void;
  atualizarPreferencias: (dados: Preferencias) => void;
};

const ContaContext = createContext<ContaContextType | null>(null);

const STORAGE_KEY = "kibrindes-mock-conta";

const store = criarStoreLocal<EstadoConta>(STORAGE_KEY, (bruto) => {
  if (!bruto) return estadoPadrao;
  try {
    const parsed = JSON.parse(bruto);
    return {
      perfil: { ...perfilPadrao, ...parsed.perfil },
      enderecos: Array.isArray(parsed.enderecos) ? parsed.enderecos : [],
      preferencias: { ...preferenciasPadrao, ...parsed.preferencias },
    };
  } catch {
    return estadoPadrao;
  }
});

export function ContaProvider({ children }: { children: ReactNode }) {
  const estado = useSyncExternalStore(
    store.inscrever,
    store.ler,
    store.lerNoServidor
  );

  const persist = useCallback((next: EstadoConta) => {
    store.escrever(JSON.stringify(next));
  }, []);

  const atualizarPerfil = useCallback(
    (dados: Perfil) => {
      const atual = store.ler();
      persist({ ...atual, perfil: dados });
    },
    [persist]
  );

  const salvarEndereco = useCallback(
    (endereco: Endereco) => {
      const atual = store.ler();
      const existe = atual.enderecos.some((e) => e.id === endereco.id);
      let lista = existe
        ? atual.enderecos.map((e) => (e.id === endereco.id ? endereco : e))
        : [...atual.enderecos, endereco];

      // Só um endereço padrão por vez.
      if (endereco.padrao) {
        lista = lista.map((e) =>
          e.id === endereco.id ? e : { ...e, padrao: false }
        );
      } else if (lista.length === 1) {
        lista = lista.map((e) => ({ ...e, padrao: true }));
      }

      persist({ ...atual, enderecos: lista });
    },
    [persist]
  );

  const removerEndereco = useCallback(
    (id: string) => {
      const atual = store.ler();
      const removiaPadrao = atual.enderecos.find((e) => e.id === id)?.padrao;
      let lista = atual.enderecos.filter((e) => e.id !== id);
      if (removiaPadrao && lista.length > 0) {
        lista = lista.map((e, i) => ({ ...e, padrao: i === 0 }));
      }
      persist({ ...atual, enderecos: lista });
    },
    [persist]
  );

  const definirEnderecoPadrao = useCallback(
    (id: string) => {
      const atual = store.ler();
      const lista = atual.enderecos.map((e) => ({ ...e, padrao: e.id === id }));
      persist({ ...atual, enderecos: lista });
    },
    [persist]
  );

  const atualizarPreferencias = useCallback(
    (dados: Preferencias) => {
      const atual = store.ler();
      persist({ ...atual, preferencias: dados });
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      perfil: estado.perfil,
      enderecos: estado.enderecos,
      preferencias: estado.preferencias,
      atualizarPerfil,
      salvarEndereco,
      removerEndereco,
      definirEnderecoPadrao,
      atualizarPreferencias,
    }),
    [
      estado,
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
