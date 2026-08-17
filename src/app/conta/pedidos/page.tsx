"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePedidos } from "@/lib/use-pedidos";
import { COR_STATUS, labelStatus, type StatusPedido } from "@/lib/status-pedido";

export default function PedidosPage() {
  const router = useRouter();
  const { logado, carregando: carregandoSessao } = useAuth();
  const { pedidos, carregando } = usePedidos();

  if (!carregandoSessao && !logado) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-4xl mb-4">📦</p>
        <h1 className="font-display text-2xl mb-2">Meus pedidos</h1>
        <p className="text-ink/60 text-sm mb-6">
          Entre na sua conta pra acompanhar seus pedidos.
        </p>
        <Link
          href="/entrar?next=/conta/pedidos"
          className="inline-block bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
        >
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button onClick={() => router.push("/conta")} className="text-sm text-ink/50 mb-4">
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-6">Meus pedidos</h1>

      {carregando && <p className="text-ink/50 text-sm text-center py-8">Carregando...</p>}

      {!carregando && pedidos.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-ink/60 text-sm">Você ainda não fez nenhum pedido.</p>
        </div>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => {
          const cor = COR_STATUS[p.status as StatusPedido] ?? "#8A8A8A";
          return (
            <Link
              key={p.id}
              href={`/conta/pedidos/${p.id}`}
              className="block bg-white border border-line rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Pedido #{p.id.slice(0, 8)}</p>
                <span
                  className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ color: cor, backgroundColor: `${cor}1a` }}
                >
                  {labelStatus(p.status)}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                {p.itens.map((it) => (
                  <span
                    key={it.id}
                    className="w-9 h-9 rounded-md flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${it.produto.cor}22` }}
                  >
                    {it.produto.emoji}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                <span className="text-ink font-medium">
                  R$ {p.total.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
