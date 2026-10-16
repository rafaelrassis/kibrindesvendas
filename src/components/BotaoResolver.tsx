"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// "Resolvido": tira o carrinho da lista de parados no painel.
export default function BotaoResolver({ alvo }: { alvo: { usuarioId?: string; email?: string } }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function resolver() {
    setEnviando(true);
    try {
      const r = await fetch("/api/admin/carrinhos/resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alvo),
      });
      if (r.ok) router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={resolver}
      disabled={enviando}
      className="underline text-[11px] text-ink/50 disabled:opacity-40"
    >
      {enviando ? "..." : "Marcar resolvido"}
    </button>
  );
}
