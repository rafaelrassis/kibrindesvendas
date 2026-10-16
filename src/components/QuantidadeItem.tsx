"use client";

import { controladoPorVariacao, estoqueDaCombinacao } from "@/lib/estoque-variacao";
import type { Produto } from "@/lib/types";

// Teto de quantidade pra uma linha do carrinho: estoque da combinação
// escolhida (produto com variação) ou estoque geral. null = não controlado.
export function estoqueMaximoDaLinha(
  produto: Produto,
  variacoesEscolhidas: Record<string, string>
): number | null {
  if (controladoPorVariacao(produto)) {
    const completa = produto.variacoes.every((v) => variacoesEscolhidas[v.tipo]);
    return completa ? estoqueDaCombinacao(produto, variacoesEscolhidas) : null;
  }
  return produto.estoque;
}

// Seletor de quantidade de uma linha do carrinho (usado na página do carrinho
// e no checkout). Item que exige personalização fica travado em 1 — é uma
// arte por unidade, então não renderiza nada.
export default function QuantidadeItem({
  produto,
  variacoesEscolhidas,
  quantidade,
  onChange,
}: {
  produto: Produto;
  variacoesEscolhidas: Record<string, string>;
  quantidade: number;
  onChange: (quantidade: number) => void;
}) {
  if (produto.requerPersonalizacao) return null;

  const minima = Math.max(1, produto.quantidadeMinima || 1);
  const estoque = estoqueMaximoDaLinha(produto, variacoesEscolhidas);
  const maxima = estoque != null ? Math.max(minima, estoque) : null;
  const limitar = (valor: number) =>
    Math.max(minima, maxima != null ? Math.min(valor, maxima) : valor);

  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-xs text-ink/50">Quantidade</span>
      {produto.quantidadePersonalizavel ? (
        <input
          type="number"
          inputMode="numeric"
          min={minima}
          max={maxima ?? undefined}
          value={quantidade}
          onChange={(e) => {
            const valor = Math.round(Number(e.target.value));
            onChange(Number.isFinite(valor) && valor > 0 ? limitar(valor) : minima);
          }}
          onBlur={() => onChange(limitar(quantidade))}
          aria-label={`Quantidade de ${produto.nome}`}
          className="w-16 h-7 border border-line rounded-full text-center text-sm font-mono"
        />
      ) : (
        <div className="flex items-center border border-line rounded-full">
          <button
            onClick={() => onChange(limitar(quantidade - 1))}
            disabled={quantidade <= minima}
            className="w-7 h-7 flex items-center justify-center text-sm disabled:opacity-30"
            aria-label={`Diminuir quantidade de ${produto.nome}`}
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-mono">{quantidade}</span>
          <button
            onClick={() => onChange(limitar(quantidade + 1))}
            disabled={maxima != null && quantidade >= maxima}
            className="w-7 h-7 flex items-center justify-center text-sm disabled:opacity-30"
            aria-label={`Aumentar quantidade de ${produto.nome}`}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
