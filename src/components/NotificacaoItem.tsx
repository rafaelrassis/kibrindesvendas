"use client";

import { useState } from "react";

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificacaoItem({
  id,
  titulo,
  mensagem,
  lida: lidaInicial,
  createdAt,
}: {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
}) {
  const [lida, setLida] = useState(lidaInicial);

  // Marcar como lida é enfeite de lista: se a chamada falhar, o aviso continua
  // lá na próxima visita e não vale interromper a leitura com um erro.
  function marcarLida() {
    if (lida) return;
    setLida(true);
    fetch(`/api/notificacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lida: true }),
    }).catch(() => setLida(false));
  }

  return (
    <button
      onClick={marcarLida}
      className={`w-full text-left rounded-lg border p-4 transition-colors ${
        lida ? "bg-white border-line" : "bg-mustard/10 border-mustard/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{titulo}</p>
        {!lida && <span className="w-2 h-2 rounded-full bg-berry shrink-0 mt-1.5" />}
      </div>
      <p className="text-sm text-ink/70 mt-1">{mensagem}</p>
      <p className="text-xs text-ink/40 mt-2">{formatarData(createdAt)}</p>
    </button>
  );
}
