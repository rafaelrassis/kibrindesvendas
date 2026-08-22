"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminPedidoRastreio({
  pedidoId,
  codigoAtual,
}: {
  pedidoId: string;
  codigoAtual: string | null;
}) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(codigoAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const mudou = codigo.trim().toUpperCase() !== (codigoAtual ?? "");

  async function salvar() {
    setSalvando(true);
    setErro("");

    const r = await fetch(`/api/admin/pedidos/${pedidoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigoRastreio: codigo }),
    }).catch(() => null);

    setSalvando(false);

    if (!r?.ok) {
      const dados = await r?.json().catch(() => null);
      setErro(dados?.error ?? "Não foi possível salvar o código.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Código de rastreio"
        aria-label="Código de rastreio"
        className="text-xs border border-line rounded-full px-2.5 py-1 bg-white font-mono w-40"
      />
      <button
        onClick={salvar}
        disabled={salvando || !mudou}
        className="text-xs px-2.5 py-1 rounded-full bg-pine/10 text-pine-2 disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
      {erro && <span className="text-xs text-berry">{erro}</span>}
    </div>
  );
}
