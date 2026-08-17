import Link from "next/link";
import NotificacaoItem from "@/components/NotificacaoItem";
import { getNotificacoes } from "@/lib/data/notificacoes";
import { usuarioIdDaSessao } from "@/lib/session";

export default async function NotificacoesPage() {
  const usuarioId = await usuarioIdDaSessao();

  if (!usuarioId) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="font-display text-2xl text-ink mb-4">Notificações</h1>
        <p className="text-ink/60 text-sm mb-6">
          Entre na sua conta pra acompanhar o andamento dos seus pedidos.
        </p>
        <Link
          href="/entrar?next=/notificacoes"
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm inline-block"
        >
          Entrar
        </Link>
      </div>
    );
  }

  const notificacoes = await getNotificacoes(usuarioId);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-2xl text-ink mb-4">Notificações</h1>

      {notificacoes.length === 0 && (
        <p className="text-ink/60 text-sm">Nenhuma notificação por aqui ainda.</p>
      )}

      <div className="space-y-2">
        {notificacoes.map((n) => (
          <NotificacaoItem
            key={n.id}
            id={n.id}
            titulo={n.titulo}
            mensagem={n.mensagem}
            lida={n.lida}
            createdAt={n.createdAt.toISOString()}
          />
        ))}
      </div>
    </div>
  );
}
