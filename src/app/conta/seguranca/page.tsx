"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function SegurancaPage() {
  const router = useRouter();
  const { sair } = useAuth();
  const [form, setForm] = useState({ atual: "", nova: "", confirmar: "" });
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvo(false);
    setErro("");

    if (form.nova.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (form.nova !== form.confirmar) {
      setErro("A confirmação não bate com a nova senha.");
      return;
    }

    setEnviando(true);
    try {
      const r = await fetch("/api/auth/senha", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual: form.atual, novaSenha: form.nova }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.error ?? "Não foi possível trocar a senha.");
        return;
      }
      setSalvo(true);
      setForm({ atual: "", nova: "", confirmar: "" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button onClick={() => router.push("/conta")} className="text-sm text-ink/50 mb-4">
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-1">Senha e segurança</h1>
      <p className="text-ink/60 text-sm mb-6">
        Sua senha atual é validada no servidor antes da troca.
      </p>

      <form onSubmit={salvar} className="space-y-4 mb-8">
        <Campo label="Senha atual">
          <input
            type="password"
            value={form.atual}
            onChange={(e) => setForm((f) => ({ ...f, atual: e.target.value }))}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>
        <Campo label="Nova senha">
          <input
            type="password"
            value={form.nova}
            onChange={(e) => setForm((f) => ({ ...f, nova: e.target.value }))}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>
        <Campo label="Confirmar nova senha">
          <input
            type="password"
            value={form.confirmar}
            onChange={(e) => setForm((f) => ({ ...f, confirmar: e.target.value }))}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>

        {erro && <p className="text-xs text-berry">{erro}</p>}
        {salvo && <p className="text-xs text-pine">Senha atualizada ✓</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-pine text-paper py-3.5 rounded-full text-sm mt-2 disabled:opacity-50"
        >
          {enviando ? "Salvando..." : "Atualizar senha"}
        </button>
      </form>

      <div className="bg-white border border-line rounded-lg p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="w-9 h-9 rounded-full bg-berry/10 text-berry flex items-center justify-center shrink-0">
            <ShieldAlert size={16} />
          </span>
          <div>
            <p className="text-sm font-medium">Sair de todos os dispositivos</p>
            <p className="text-xs text-ink/50 mt-0.5">
              Encerra sua sessão neste e em qualquer outro aparelho conectado.
            </p>
          </div>
        </div>
        <button
          onClick={sair}
          className="w-full border border-berry text-berry py-2.5 rounded-full text-sm"
        >
          Encerrar todas as sessões
        </button>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink/50 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
