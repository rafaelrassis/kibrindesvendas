"use client";

import { useEffect, useState } from "react";
import type { Produto } from "@/lib/types";

// Como useProduto, mas pra vários ids de uma vez (carrinho e checkout). A
// resposta guarda a chave dos ids que originou a busca, então "carregando" é
// derivado: enquanto a resposta não corresponde à lista pedida, está
// carregando. Produto que sumiu do catálogo aparece como `undefined` no mapa.
type Resposta = { chave: string; produtos: Record<string, Produto | undefined> };

export function useProdutos(ids: string[]) {
  const chave = [...new Set(ids)].sort().join(",");
  const [resposta, setResposta] = useState<Resposta | undefined>(undefined);

  useEffect(() => {
    if (!chave) return;
    let ativo = true;

    Promise.all(
      chave.split(",").map(async (id) => {
        try {
          const r = await fetch(`/api/produtos/${id}`);
          return [id, r.ok ? ((await r.json()) as Produto) : undefined] as const;
        } catch {
          return [id, undefined] as const;
        }
      })
    ).then((entradas) => {
      if (ativo) setResposta({ chave, produtos: Object.fromEntries(entradas) });
    });

    return () => {
      ativo = false;
    };
  }, [chave]);

  const atual = chave !== "" && resposta?.chave === chave ? resposta : undefined;

  return {
    produtos: atual?.produtos ?? {},
    // Sem ids não há o que carregar.
    carregando: chave !== "" && atual === undefined,
  };
}
