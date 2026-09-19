"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const paraTexto = (n: number | null) => (n != null ? n.toFixed(2).replace(".", ",") : "");

// Custo real da etiqueta (o que a loja pagou à transportadora). Alimenta o DRE.
export default function AdminPedidoFreteCusto({
  pedidoId,
  custoAtual,
}: {
  pedidoId: string;
  custoAtual: number | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(paraTexto(custoAtual));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const mudou = valor.trim() !== paraTexto(custoAtual);

  async function salvar() {
    setSalvando(true);
    setErro("");

    const r = await fetch(`/api/admin/pedidos/${pedidoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freteCusto: valor }),
    }).catch(() => null);

    setSalvando(false);

    if (!r?.ok) {
      const dados = await r?.json().catch(() => null);
      setErro(dados?.error ?? "Não foi possível salvar o custo.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(".", ","))}
        inputMode="decimal"
        placeholder="Custo da etiqueta (R$)"
        aria-label="Custo da etiqueta"
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
