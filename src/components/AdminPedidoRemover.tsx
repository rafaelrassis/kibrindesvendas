"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminPedidoRemover({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState("");

  async function remover() {
    setRemovendo(true);
    setErro("");

    const r = await fetch(`/api/admin/pedidos/${pedidoId}`, { method: "DELETE" }).catch(
      () => null
    );

    if (!r?.ok) {
      const dados = await r?.json().catch(() => null);
      setErro(dados?.error ?? "Não foi possível excluir o pedido.");
      setRemovendo(false);
      return;
    }

    router.refresh();
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs text-berry">Excluir de vez este pedido?</span>
        <button
          onClick={remover}
          disabled={removendo}
          className="text-xs px-2.5 py-1 rounded-full bg-berry text-white disabled:opacity-40"
        >
          {removendo ? "Excluindo..." : "Confirmar"}
        </button>
        <button
          onClick={() => setConfirmando(false)}
          disabled={removendo}
          className="text-xs px-2.5 py-1 rounded-full bg-ink/5 text-ink/60"
        >
          Cancelar
        </button>
        {erro && <span className="text-xs text-berry">{erro}</span>}
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setConfirmando(true)}
        className="text-xs px-2.5 py-1 rounded-full bg-berry/10 text-berry"
      >
        Excluir pedido
      </button>
      {erro && <span className="text-xs text-berry ml-2">{erro}</span>}
    </div>
  );
}
