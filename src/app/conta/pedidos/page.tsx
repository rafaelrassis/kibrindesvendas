"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { pedidosMock, type StatusPedido } from "@/lib/conta-data";

const corStatus: Record<StatusPedido, string> = {
  "Aguardando arte": "#D9A63E",
  "Em produção": "#D9A63E",
  Enviado: "#9C1C95",
  Entregue: "#3F6B4C",
  Cancelado: "#B23A48",
};

export default function PedidosPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button onClick={() => router.push("/conta")} className="text-sm text-ink/50 mb-4">
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-6">Meus pedidos</h1>

      {pedidosMock.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-ink/60 text-sm">Você ainda não fez nenhum pedido.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...pedidosMock].reverse().map((p) => (
            <Link
              key={p.id}
              href={`/conta/pedidos/${p.id}`}
              className="block bg-white border border-line rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Pedido {p.id}</p>
                <span
                  className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{
                    color: corStatus[p.status],
                    backgroundColor: `${corStatus[p.status]}1a`,
                  }}
                >
                  {p.status}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                {p.itens.map((it, i) => (
                  <span
                    key={i}
                    className="w-9 h-9 rounded-md flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${it.cor}22` }}
                  >
                    {it.emoji}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>{new Date(p.data).toLocaleDateString("pt-BR")}</span>
                <span className="text-ink font-medium">
                  R$ {p.total.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
