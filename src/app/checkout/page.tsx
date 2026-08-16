"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getProduto } from "@/lib/mock-data";
import { useCart } from "@/lib/cart-context";
import { compararPreco } from "@/lib/compare-price";

export default function CheckoutPage() {
  const router = useRouter();
  const { item, limpar } = useCart();
  const [processando, setProcessando] = useState(false);

  const produto = item ? getProduto(item.produtoId) : undefined;

  if (!item || !produto) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-ink/60 mb-4">Seu carrinho está vazio.</p>
        <button
          onClick={() => router.push("/")}
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
        >
          Ver produtos
        </button>
      </div>
    );
  }

  const precisaArte = produto.requerPersonalizacao && !item.personalizacao?.aceite;
  const comparacao = compararPreco(produto.precoShopee, produto.preco);

  function pagar() {
    setProcessando(true);
    setTimeout(() => {
      router.push("/pedido/confirmado");
      setTimeout(limpar, 300);
    }, 900);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl mb-8">Finalizar pedido</h1>

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <div className="flex gap-4">
          <div
            className="w-16 h-16 rounded-md flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${produto.cor}22` }}
          >
            {produto.emoji}
          </div>
          <div className="flex-1">
            <p className="font-medium">{produto.nome}</p>
            <p className="text-xs text-ink/50">
              {Object.entries(item.variacoesEscolhidas)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </p>
            {item.personalizacao && (
              <p className="text-xs text-pine-2 mt-1">✓ {item.personalizacao.resumo}</p>
            )}
          </div>
          <p className="font-mono font-medium">
            R$ {produto.preco.toFixed(2).replace(".", ",")}
          </p>
        </div>
      </div>

      {precisaArte && (
        <div className="bg-berry/10 border border-berry/40 text-berry text-sm rounded-md px-4 py-3 mb-5">
          Falta definir e confirmar a arte antes de pagar.{" "}
          <button
            onClick={() => router.push(`/personalizar/${produto.id}`)}
            className="underline font-medium"
          >
            Voltar pra personalização
          </button>
        </div>
      )}

      {comparacao.mostrar && (
        <div className="bg-white border border-line rounded-lg p-5 mb-5">
          <p className="text-sm font-medium mb-3">Comparativo de preço</p>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink/60">Na Shopee</span>
            <span className="line-through text-ink/40 font-mono">
              R$ {produto.precoShopee.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="flex justify-between text-sm font-medium mb-1.5">
            <span>Aqui no site</span>
            <span className="font-mono text-pine-2">
              R$ {produto.preco.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="flex justify-between text-sm text-berry">
            <span>Você economiza</span>
            <span className="font-mono">
              R$ {(comparacao.economia ?? 0).toFixed(2).replace(".", ",")} (
              {comparacao.percentual}%)
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border border-line rounded-lg p-5 mb-8">
        <p className="text-sm font-medium mb-3">Pagamento</p>
        <div className="grid grid-cols-3 gap-2">
          {["Pix", "Cartão", "Boleto"].map((m) => (
            <button
              key={m}
              className="border border-line rounded-md py-2.5 text-sm first:bg-pine first:text-paper first:border-pine"
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink/40 mt-3">
          Simulação — nenhum pagamento real é processado neste protótipo.
        </p>
      </div>

      <button
        onClick={pagar}
        disabled={precisaArte || processando}
        className="w-full bg-berry text-paper font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
      >
        {processando
          ? "Processando pagamento..."
          : `Pagar R$ ${produto.preco.toFixed(2).replace(".", ",")}`}
      </button>
    </div>
  );
}
