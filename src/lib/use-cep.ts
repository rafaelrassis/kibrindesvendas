"use client";

import { useEffect, useState } from "react";
import { normalizarCep, type OpcaoFrete } from "@/lib/frete";

export type EnderecoConsultado = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  opcoesFrete: OpcaoFrete[];
  frete: OpcaoFrete;
};

// Como em useProduto: a resposta guarda o CEP (e a quantidade) que originou
// a busca, então "consultando" é derivado e resposta atrasada não vale.
// Só o CEP não bastava: o frete real (Melhor Envio) depende do peso total,
// que depende da quantidade — sem guardá-la aqui, mudar a quantidade com o
// mesmo CEP fazia o frete da quantidade antiga continuar de pé, sem nenhum
// aviso de "Calculando...", até a resposta nova chegar.
type Resposta = { cep: string; quantidade: number; endereco?: EnderecoConsultado; erro?: string };

// Chave estável pra comparar/depender das variações escolhidas sem disparar
// o efeito de novo a cada render por causa de um objeto novo com o mesmo
// conteúdo (ex: pai recriando o Record a cada render).
function chaveVariacoes(v?: Record<string, string>): string {
  if (!v) return "";
  return Object.keys(v)
    .sort()
    .map((k) => `${k}:${v[k]}`)
    .join("|");
}

// Consulta o CEP (endereço + frete) sempre que ele fica completo. CEP
// incompleto não dispara nada — é o estado normal de quem está digitando.
// `variacoesEscolhidas` afeta o peso/dimensão cotados quando o produto tem
// peso por valor de variação (ex: tamanho de ímã) — ver dimensaoEfetiva.
export function useCep(
  valor: string,
  produtoId?: string,
  quantidade = 1,
  variacoesEscolhidas?: Record<string, string>
) {
  const cep = normalizarCep(valor);
  const [resposta, setResposta] = useState<Resposta | undefined>(undefined);
  const variacoesKey = chaveVariacoes(variacoesEscolhidas);

  useEffect(() => {
    if (!cep) return;
    let ativo = true;

    const params = new URLSearchParams();
    if (produtoId) params.set("produtoId", produtoId);
    if (quantidade > 1) params.set("quantidade", String(quantidade));
    if (variacoesEscolhidas && Object.keys(variacoesEscolhidas).length > 0) {
      params.set("variacoes", JSON.stringify(variacoesEscolhidas));
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- variacoesKey já resume variacoesEscolhidas
  }, [cep, produtoId, quantidade, variacoesKey]);

  const atual =
    cep && resposta?.cep === cep && resposta?.quantidade === quantidade ? resposta : undefined;

  return {
    endereco: atual?.endereco ?? null,
    erro: atual?.erro ?? "",
    // Sem CEP completo não há o que consultar.
    consultando: !!cep && atual === undefined,
  };
}
