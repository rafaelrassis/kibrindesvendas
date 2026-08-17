"use client";

import { useEffect, useState } from "react";
import { normalizarCep, type Frete } from "@/lib/frete";

export type EnderecoConsultado = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  frete: Frete;
};

// Como em useProduto: a resposta guarda o CEP que originou a busca, então
// "consultando" é derivado e resposta atrasada de um CEP antigo não vale.
type Resposta = { cep: string; endereco?: EnderecoConsultado; erro?: string };

// Consulta o CEP (endereço + frete) sempre que ele fica completo. CEP
// incompleto não dispara nada — é o estado normal de quem está digitando.
export function useCep(valor: string) {
  const cep = normalizarCep(valor);
  const [resposta, setResposta] = useState<Resposta | undefined>(undefined);

  useEffect(() => {
    if (!cep) return;
    let ativo = true;

    fetch(`/api/cep/${cep}`)
      .then(async (r) => {
        const dados = await r.json();
        if (!ativo) return;
        setResposta(
          r.ok
            ? { cep, endereco: dados }
            : { cep, erro: dados.error ?? "Não foi possível consultar o CEP." }
        );
      })
      .catch(() => {
        if (ativo) setResposta({ cep, erro: "Não foi possível consultar o CEP agora." });
      });

    return () => {
      ativo = false;
    };
  }, [cep]);

  const atual = cep && resposta?.cep === cep ? resposta : undefined;

  return {
    endereco: atual?.endereco ?? null,
    erro: atual?.erro ?? "",
    // Sem CEP completo não há o que consultar.
    consultando: !!cep && atual === undefined,
  };
}
