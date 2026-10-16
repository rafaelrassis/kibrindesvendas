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

// Uma linha do carrinho do ponto de vista do frete (peso e origem).
export type LinhaConsultaCep = {
  produtoId: string;
  quantidade: number;
  variacoes?: Record<string, string>;
};

// Como em useProduto: a resposta guarda o CEP (e as linhas) que originou a
// busca, então "consultando" é derivado e resposta atrasada não vale.
// Só o CEP não bastava: o frete real depende do peso total, que depende da
// quantidade e dos produtos — sem guardá-los aqui, mudar o carrinho com o
// mesmo CEP fazia o frete antigo continuar de pé, sem nenhum aviso de
// "Calculando...", até a resposta nova chegar.
type Resposta = { cep: string; chave: string; endereco?: EnderecoConsultado; erro?: string };

// Chave estável pra comparar/depender das linhas sem disparar o efeito de novo
// a cada render por causa de um objeto novo com o mesmo conteúdo.
function chaveVariacoes(v?: Record<string, string>): string {
  if (!v) return "";
  return Object.keys(v)
    .sort()
    .map((k) => `${k}:${v[k]}`)
    .join("|");
}

function chaveLinhas(linhas: LinhaConsultaCep[]): string {
  return linhas
    .map((l) => `${l.produtoId}#${l.quantidade}#${chaveVariacoes(l.variacoes)}`)
    .join(";");
}

// Consulta o CEP (endereço + frete) sempre que ele fica completo. CEP
// incompleto não dispara nada — é o estado normal de quem está digitando.
// `linhas` define o que está sendo enviado: uma linha só na página do produto,
// o carrinho inteiro no checkout. Variações afetam o peso/dimensão cotados
// quando o produto tem peso por valor de variação (ex: tamanho de ímã).
export function useCep(valor: string, linhas: LinhaConsultaCep[] = []) {
  const cep = normalizarCep(valor);
  const [resposta, setResposta] = useState<Resposta | undefined>(undefined);
  const chave = chaveLinhas(linhas);

  useEffect(() => {
    if (!cep) return;
    let ativo = true;

    const params = new URLSearchParams();
    if (linhas.length > 0) params.set("itens", JSON.stringify(linhas));
    const query = params.toString();
    const url = query ? `/api/cep/${cep}?${query}` : `/api/cep/${cep}`;

    fetch(url)
      .then(async (r) => {
        const dados = await r.json();
        if (!ativo) return;
        setResposta(
          r.ok
            ? { cep, chave, endereco: dados }
            : { cep, chave, erro: dados.error ?? "Não foi possível consultar o CEP." }
        );
      })
      .catch(() => {
        if (ativo) setResposta({ cep, chave, erro: "Não foi possível consultar o CEP agora." });
      });

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chave` já resume `linhas`
  }, [cep, chave]);

  const atual = cep && resposta?.cep === cep && resposta?.chave === chave ? resposta : undefined;

  return {
    endereco: atual?.endereco ?? null,
    erro: atual?.erro ?? "",
    // Sem CEP completo não há o que consultar.
    consultando: !!cep && atual === undefined,
  };
}
