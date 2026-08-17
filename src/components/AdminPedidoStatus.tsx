"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LABEL_STATUS, STATUS_PEDIDO } from "@/lib/status-pedido";

export default function AdminPedidoStatus({
  pedidoId,
  statusAtual,
}: {
  pedidoId: string;
  statusAtual: string;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function alterar(status: string) {
    setSalvando(true);
    setErro("");

    const r = await fetch(`/api/admin/pedidos/${pedidoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);

    setSalvando(false);

    if (!r?.ok) {
      const dados = await r?.json().catch(() => null);
      setErro(dados?.error ?? "Não foi possível mudar o status.");
      return;
    }

    // A lista é renderizada no servidor: recarrega pra mostrar o status novo.
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={statusAtual}
        onChange={(e) => alterar(e.target.value)}
        disabled={salvando}
        aria-label="Status do pedido"
        className="text-xs border border-line rounded-full px-2 py-1 bg-white disabled:opacity-50"
      >
        {STATUS_PEDIDO.map((status) => (
          <option key={status} value={status}>
            {LABEL_STATUS[status]}
          </option>
        ))}
      </select>
      {erro && <span className="text-xs text-berry">{erro}</span>}
    </div>
  );
}
