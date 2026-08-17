"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useNotificacoes } from "@/lib/notificacoes-context";

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificacoesPage() {
  const { logado, carregando: carregandoSessao } = useAuth();
  const { notificacoes, carregando, marcarLida } = useNotificacoes();

  if (!carregandoSessao && !logado) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-4xl mb-4">🔔</p>
        <h1 className="font-display text-2xl mb-2">Notificações</h1>
        <p className="text-ink/60 text-sm mb-6">
          Entre na sua conta pra acompanhar as atualizações dos seus pedidos.
        </p>
        <Link
          href="/entrar?next=/notificacoes"
          className="inline-block bg-pine text-white text-sm px-5 py-2.5 rounded-full hover:bg-pine-2 transition-colors"
        >
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-2xl text-ink mb-4">Notificações</h1>

      {carregando && <p className="text-ink/60 text-sm">Carregando...</p>}

      {!carregando && notificacoes.length === 0 && (
        <p className="text-ink/60 text-sm">Nenhuma notificação por aqui ainda.</p>
      )}

      <div className="space-y-2">
        {notificacoes.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => !n.lida && marcarLida(n.id)}
            aria-label={n.lida ? undefined : "Marcar como lida"}
            className={`w-full text-left rounded-lg border p-4 transition-colors ${
              n.lida ? "bg-white border-line" : "bg-mustard/10 border-mustard/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{n.titulo}</p>
              {!n.lida && <span className="w-2 h-2 rounded-full bg-berry shrink-0 mt-1.5" />}
            </div>
            <p className="text-sm text-ink/70 mt-1">{n.mensagem}</p>
            <p className="text-xs text-ink/40 mt-2">{formatarData(n.createdAt)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
