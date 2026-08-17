"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getProduto } from "@/lib/mock-data";
import { useCart } from "@/lib/cart-context";
import { compararPreco } from "@/lib/compare-price";
import FavoritoButton from "@/components/FavoritoButton";

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

  const comparacao = compararPreco(produto.precoShopee, produto.preco);
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
    <div className="pb-36 md:pb-0">
      {/* Voltar */}
      <div className="mx-auto max-w-5xl px-5 pt-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-ink/60 hover:text-ink"
        >
          ← Voltar
        </button>
      </div>

      <div className="mx-auto max-w-5xl px-5 pt-4 pb-8 grid md:grid-cols-2 gap-10">
        <div>
          {/* Comparação de preço, estilo "Achamos uma oferta melhor" */}
          {comparacao.mostrar && (
            <div className="bg-paper-2 border border-line rounded-lg p-4 mb-4">
              <p className="text-sm font-medium mb-3">Compare com a Shopee</p>
              <div className="bg-white border border-line rounded-lg p-4 flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded flex items-center justify-center text-3xl shrink-0"
                  style={{ backgroundColor: `${produto.cor}22` }}
                >
                  {produto.emoji}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-ink/50 line-through">
                    R$ {produto.precoShopee.toFixed(2).replace(".", ",")} na Shopee
                  </p>
                  <p className="font-mono text-lg font-semibold">
                    R$ {produto.preco.toFixed(2).replace(".", ",")}{" "}
                    <span className="text-berry text-sm font-normal">
                      -{comparacao.percentual}%
                    </span>
                  </p>
                  <p className="text-xs text-ink/50">sem taxa de plataforma</p>
                </div>
              </div>
            </div>
          )}

          {/* Imagem com favorito e compartilhar */}
          <div className="relative">
            <div
              className="aspect-square rounded-lg flex items-center justify-center text-8xl"
              style={{ backgroundColor: `${produto.cor}22` }}
            >
              {produto.emoji}
            </div>
            <FavoritoButton
              produtoId={produto.id}
              tamanho="lg"
              className="absolute top-3 right-3"
            />
            <button
              aria-label="Compartilhar"
              className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-base"
            >
              🔗
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">
            {produto.categoriaLabel}
          </p>
          <h1 className="font-display text-3xl mb-3">{produto.nome}</h1>
          <p className="text-ink/70 mb-5">{produto.descricao}</p>

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
                            ? "bg-pine text-white border-pine"
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

          {/* CTA — só desktop aqui, mobile vai na barra fixa */}
          <button
            onClick={continuar}
            disabled={faltaEscolher}
            className="hidden md:inline-flex bg-pine text-white font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
          >
            {produto.requerPersonalizacao
              ? "Avançar para personalização"
              : "Adicionar e ir pro checkout"}
          </button>
          {faltaEscolher && (
            <p className="hidden md:block text-xs text-ink/40 mt-2">
              Escolha todas as variações pra continuar.
            </p>
          )}
        </div>
      </div>

      {/* Barra fixa de preço + CTA, estilo Magalu (mobile) */}
      <div className="md:hidden fixed bottom-16 inset-x-0 z-20 bg-white border-t border-line px-5 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-lg font-semibold leading-none">
            R$ {produto.preco.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-[11px] text-ink/50">no Pix</p>
        </div>
        <button
          onClick={continuar}
          disabled={faltaEscolher}
          className="flex-1 max-w-[220px] bg-pine text-white font-medium px-5 py-3 rounded-full disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          👜 Adicionar à sacola
        </button>
      </div>
    </div>
  );
}
