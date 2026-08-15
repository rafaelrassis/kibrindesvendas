"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getProduto } from "@/lib/mock-data";
import { useCart } from "@/lib/cart-context";

export default function ProdutoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const produto = getProduto(id);
  const { iniciarItem } = useCart();

  const [selecoes, setSelecoes] = useState<Record<string, string>>({});

  if (!produto) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-ink/60">Produto não encontrado.</p>
      </div>
    );
  }

  const faltaEscolher = produto.variacoes.some((v) => !selecoes[v.tipo]);

  function continuar() {
    if (!produto) return;
    iniciarItem(produto.id, selecoes);
    if (produto.requerPersonalizacao) {
      router.push(`/personalizar/${produto.id}`);
    } else {
      router.push("/checkout");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 grid md:grid-cols-2 gap-12">
      <div
        className="aspect-square rounded-lg flex items-center justify-center text-8xl"
        style={{ backgroundColor: `${produto.cor}22` }}
      >
        {produto.emoji}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">
          {produto.categoriaLabel}
        </p>
        <h1 className="font-display text-3xl mb-3">{produto.nome}</h1>
        <p className="text-ink/70 mb-5">{produto.descricao}</p>

        <div className="flex items-baseline gap-3 font-mono mb-6">
          <span className="text-2xl font-medium">
            R$ {produto.preco.toFixed(2).replace(".", ",")}
          </span>
          <span className="text-sm text-ink/40 line-through">
            R$ {produto.precoShopee.toFixed(2).replace(".", ",")}
          </span>
        </div>

        {produto.requerPersonalizacao && (
          <div className="bg-mustard/15 border border-mustard/40 text-pine-2 text-sm rounded-md px-4 py-3 mb-6">
            Este produto passa por um fluxo de personalização depois de
            escolhidas as variações.
          </div>
        )}

        <div className="space-y-6 mb-8">
          {produto.variacoes.map((v) => (
            <div key={v.tipo}>
              <p className="text-sm font-medium mb-2">{v.tipo}</p>
              <div className="flex flex-wrap gap-2">
                {v.valores.map((valor) => {
                  const ativo = selecoes[v.tipo] === valor;
                  return (
                    <button
                      key={valor}
                      onClick={() =>
                        setSelecoes((s) => ({ ...s, [v.tipo]: valor }))
                      }
                      className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                        ativo
                          ? "bg-pine text-paper border-pine"
                          : "border-line hover:border-pine/50"
                      }`}
                    >
                      {valor}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={continuar}
          disabled={faltaEscolher}
          className="w-full md:w-auto bg-berry text-paper font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
        >
          {produto.requerPersonalizacao
            ? "Avançar para personalização"
            : "Adicionar e ir pro checkout"}
        </button>
        {faltaEscolher && (
          <p className="text-xs text-ink/40 mt-2">
            Escolha todas as variações pra continuar.
          </p>
        )}
      </div>
    </div>
  );
}
