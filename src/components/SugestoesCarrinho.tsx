"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { precoEfetivo } from "@/lib/estoque-variacao";
import type { Produto } from "@/lib/types";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

// "Compre junto": produtos das mesmas categorias do carrinho. Os de um clique
// (sem variação nem personalização) entram direto; os demais levam à página do
// produto, onde a pessoa escolhe antes de adicionar.
export default function SugestoesCarrinho() {
  const { itens, adicionarItem } = useCart();
  const idsChave = [...new Set(itens.map((i) => i.produtoId))].sort().join(",");
  const [resposta, setResposta] = useState<{ chave: string; produtos: Produto[] } | null>(null);

  useEffect(() => {
    if (!idsChave) return;
    let ativo = true;
    fetch(`/api/produtos/sugestoes?ids=${encodeURIComponent(idsChave)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((produtos: Produto[]) => ativo && setResposta({ chave: idsChave, produtos }))
      .catch(() => ativo && setResposta({ chave: idsChave, produtos: [] }));
    return () => {
      ativo = false;
    };
  }, [idsChave]);

  // Resposta de outra composição do carrinho já não vale (produto que acabou de
  // entrar no carrinho some da lista sozinho, sem esperar a nova busca).
  const ids = new Set(itens.map((i) => i.produtoId));
  const produtos = (resposta?.chave === idsChave ? resposta.produtos : []).filter(
    (p) => !ids.has(p.id)
  );
  if (produtos.length === 0) return null;

  return (
    <section className="mb-8" aria-label="Compre junto">
      <h2 className="font-display text-xl mb-3">Compre junto</h2>
      <div className="grid grid-cols-2 gap-3">
        {produtos.map((p) => {
          const umClique = p.variacoes.length === 0 && !p.requerPersonalizacao;
          return (
            <div key={p.id} className="bg-white border border-line rounded-lg p-3 flex flex-col">
              <Link href={`/produto/${p.id}`} className="block">
                <div
                  className="w-full aspect-square rounded-md flex items-center justify-center text-3xl mb-2 overflow-hidden"
                  style={{ backgroundColor: `${p.cor}22` }}
                >
                  {p.imagens[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagens[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    p.emoji
                  )}
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-2">{p.nome}</p>
              </Link>
              <p className="font-mono text-sm mt-1">{reais(precoEfetivo(p, {}))}</p>
              {umClique ? (
                <button
                  onClick={() =>
                    adicionarItem({
                      produtoId: p.id,
                      variacoesEscolhidas: {},
                      quantidade: Math.max(1, p.quantidadeMinima || 1),
                      precoAdicionado: precoEfetivo(p, {}),
                    })
                  }
                  className="mt-2 text-xs border border-pine text-pine-2 rounded-full py-1.5 hover:bg-pine/5 transition"
                >
                  + Adicionar
                </button>
              ) : (
                <Link
                  href={`/produto/${p.id}`}
                  className="mt-2 text-xs text-center border border-line rounded-full py-1.5 hover:bg-paper-2 transition"
                >
                  Ver opções
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
