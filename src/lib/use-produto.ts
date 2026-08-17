"use client";

import { useEffect, useState } from "react";
import type { Produto } from "@/lib/types";

// A resposta guarda o id que originou a busca: assim "carregando" é derivado
// (resposta ainda não corresponde ao id pedido) em vez de virar mais um estado.
type Resposta = { id: string; produto: Produto | undefined };

export function useProduto(id: string | undefined) {
  const [resposta, setResposta] = useState<Resposta | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    fetch(`/api/produtos/${id}`)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((produto: Produto | undefined) => {
        if (ativo) setResposta({ id, produto });
      })
      .catch(() => {
        if (ativo) setResposta({ id, produto: undefined });
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  const atual = id !== undefined && resposta?.id === id ? resposta : undefined;

  return {
    produto: atual?.produto,
    // Sem id não há o que carregar.
    carregando: id !== undefined && atual === undefined,
  };
}

export function useProdutos() {
  const [produtos, setProdutos] = useState<Produto[] | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    fetch("/api/produtos")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Produto[]) => {
        if (ativo) setProdutos(lista);
      })
      .catch(() => {
        if (ativo) setProdutos([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { produtos: produtos ?? [], carregando: produtos === undefined };
}
