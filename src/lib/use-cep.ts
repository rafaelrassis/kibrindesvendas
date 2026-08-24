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

// Como em useProduto: a resposta guarda o CEP (e a quantidade) que originou
// a busca, então "consultando" é derivado e resposta atrasada não vale.
// Só o CEP não bastava: o frete real (Melhor Envio) depende do peso total,
// que depende da quantidade — sem guardá-la aqui, mudar a quantidade com o
// mesmo CEP fazia o frete da quantidade antiga continuar de pé, sem nenhum
// aviso de "Calculando...", até a resposta nova chegar.
type Resposta = { cep: string; quantidade: number; endereco?: EnderecoConsultado; erro?: string };

// Consulta o CEP (endereço + frete) sempre que ele fica completo. CEP
// incompleto não dispara nada — é o estado normal de quem está digitando.
export function useCep(valor: string, produtoId?: string, quantidade = 1) {
  const cep = normalizarCep(valor);
  const [resposta, setResposta] = useState<Resposta | undefined>(undefined);

  useEffect(() => {
    if (!cep) return;
    let ativo = true;

    const params = new URLSearchParams();
    if (produtoId) params.set("produtoId", produtoId);
    if (quantidade > 1) params.set("quantidade", String(quantidade));
    const query = params.toString();
    const url = query ? `/api/cep/${cep}?${query}` : `/api/cep/${cep}`;

    fetch(url)
      .then(async (r) => {
        const dados = await r.json();
        if (!ativo) return;
        setResposta(
          r.ok
            ? { cep, quantidade, endereco: dados }
            : { cep, quantidade, erro: dados.error ?? "Não foi possível consultar o CEP." }
        );
      })
      .catch(() => {
        if (ativo) setResposta({ cep, quantidade, erro: "Não foi possível consultar o CEP agora." });
      });

    return () => {
      ativo = false;
    };
  }, [cep, produtoId, quantidade]);

  const atual =
    cep && resposta?.cep === cep && resposta?.quantidade === quantidade ? resposta : undefined;

  return {
    endereco: atual?.endereco ?? null,
    erro: atual?.erro ?? "",
    // Sem CEP completo não há o que consultar.
    consultando: !!cep && atual === undefined,
  };
}
