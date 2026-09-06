"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminPedidoReembolso({
  pedidoId,
  valorJaReembolsado,
}: {
  pedidoId: string;
  valorJaReembolsado: number | null;
}) {
  const router = useRouter();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function reembolsar() {
    setErro("");
    setEnviando(true);

    const r = await fetch(`/api/admin/pedidos/${pedidoId}/reembolso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: Number(valor.replace(",", ".")), motivo }),
    }).catch(() => null);

    setEnviando(false);

    if (!r?.ok) {
      const dados = await r?.json().catch(() => null);
      setErro(dados?.error ?? "Não foi possível registrar o reembolso.");
      return;
    }

    setMostrarForm(false);
    setValor("");
    setMotivo("");
    router.refresh();
  }

  if (!mostrarForm) {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={() => setMostrarForm(true)}
          className="text-xs px-2.5 py-1 rounded-full bg-berry/10 text-berry"
        >
          {valorJaReembolsado ? "Reembolsar mais" : "Reembolsar sem devolução"}
        </button>
        {valorJaReembolsado ? (
          <span className="text-xs text-ink/50">
            Já reembolsado: R$ {valorJaReembolsado.toFixed(2).replace(".", ",")}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-1.5 p-3 bg-berry/5 rounded-lg space-y-2">
      <p className="text-xs text-ink/60">
        O cliente fica com o produto e recebe o valor abaixo de volta. Ele recebe um e-mail
        avisando.
      </p>
      <div className="flex gap-2">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Valor (ex: 25,00)"
          inputMode="decimal"
          aria-label="Valor a reembolsar"
          className="text-xs border border-line rounded-full px-2.5 py-1 bg-white w-32"
        />
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo do reembolso"
          aria-label="Motivo do reembolso"
          className="text-xs border border-line rounded-full px-2.5 py-1 bg-white flex-1"
        />
      </div>
      {erro && <p className="text-xs text-berry">{erro}</p>}
      <div className="flex gap-2">
        <button
          onClick={reembolsar}
          disabled={enviando || !valor.trim() || !motivo.trim()}
          className="text-xs px-2.5 py-1 rounded-full bg-berry text-paper disabled:opacity-40"
        >
          {enviando ? "Enviando..." : "Confirmar reembolso"}
        </button>
        <button onClick={() => setMostrarForm(false)} className="text-xs text-ink/50">
          Cancelar
        </button>
      </div>
    </div>
  );
}
