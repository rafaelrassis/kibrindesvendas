"use client";

import { useRouter, useParams } from "next/navigation";
import { Check } from "lucide-react";
import { getPedido } from "@/lib/conta-data";

export default function DetalhePedidoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pedido = getPedido(params.id);

  if (!pedido) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-ink/60 text-sm mb-6">Pedido não encontrado.</p>
        <button
          onClick={() => router.push("/conta/pedidos")}
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
        >
          Voltar aos pedidos
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button
        onClick={() => router.push("/conta/pedidos")}
        className="text-sm text-ink/50 mb-4"
      >
        ← Voltar
      </button>

      <h1 className="font-display text-2xl mb-1">Pedido {pedido.id}</h1>
      <p className="text-ink/60 text-sm mb-6">
        Feito em {new Date(pedido.data).toLocaleDateString("pt-BR")}
      </p>

      {/* Timeline */}
      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <p className="text-xs uppercase tracking-wide text-ink/40 mb-4">Status</p>
        <div className="space-y-0">
          {pedido.etapas.map((etapa, i) => (
            <div key={etapa.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    etapa.feita ? "bg-pine text-paper" : "bg-paper-2 text-ink/30"
                  }`}
                >
                  {etapa.feita ? <Check size={13} /> : null}
                </span>
                {i < pedido.etapas.length - 1 && (
                  <span
                    className={`w-0.5 flex-1 min-h-[24px] ${
                      etapa.feita ? "bg-pine" : "bg-line"
                    }`}
                  />
                )}
              </div>
              <div className="pb-5">
                <p className={`text-sm ${etapa.feita ? "text-ink" : "text-ink/40"}`}>
                  {etapa.label}
                </p>
                {etapa.data && <p className="text-xs text-ink/40">{etapa.data}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Itens */}
      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <p className="text-xs uppercase tracking-wide text-ink/40 mb-3">Itens</p>
        {pedido.itens.map((it, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <span
              className="w-11 h-11 rounded-md flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: `${it.cor}22` }}
            >
              {it.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{it.produtoNome}</p>
              <p className="text-xs text-ink/50">
                {it.variacao} · Qtd {it.qtd}
              </p>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-line">
          <span className="text-sm text-ink/60">Total</span>
          <span className="font-medium">
            R$ {pedido.total.toFixed(2).replace(".", ",")}
          </span>
        </div>
      </div>

      {/* Entrega */}
      <div className="bg-white border border-line rounded-lg p-5">
        <p className="text-xs uppercase tracking-wide text-ink/40 mb-2">
          Endereço de entrega
        </p>
        <p className="text-sm text-ink/80">{pedido.enderecoResumo}</p>
      </div>
    </div>
  );
}
