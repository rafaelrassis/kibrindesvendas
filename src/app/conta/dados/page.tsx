"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConta } from "@/lib/conta-context";
import type { Perfil } from "@/lib/conta-data";
import { formatarCpf } from "@/lib/cpf";

export default function DadosPage() {
  const router = useRouter();
  const { perfil, atualizarPerfil, carregando } = useConta();
  const [form, setForm] = useState<Perfil>(perfil);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // O perfil chega depois via fetch (useConta); ajuste de estado derivado da
  // prop, feito durante o render — sem isso o form abriria sempre vazio.
  const [perfilAnterior, setPerfilAnterior] = useState(perfil);
  if (!carregando && perfil !== perfilAnterior) {
    setPerfilAnterior(perfil);
    setForm(perfil);
  }

  function campo<K extends keyof Perfil>(chave: K, valor: Perfil[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
    setSalvo(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await atualizarPerfil(form);
      setSalvo(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button
        onClick={() => router.push("/conta")}
        className="text-sm text-ink/50 mb-4"
      >
        ← Voltar
      </button>
      <h1 className="font-display text-2xl mb-1">Meus dados</h1>
      <p className="text-ink/60 text-sm mb-6">
        Essas informações são usadas na entrega e no contato sobre seus pedidos.
      </p>

      <form onSubmit={salvar} className="space-y-4">
        <Campo label="Nome completo">
          <input
            value={form.nome}
            onChange={(e) => campo("nome", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>

        <Campo label="E-mail">
          <input
            type="email"
            value={form.email}
            disabled
            className="w-full bg-paper-2 border border-line rounded-lg px-4 py-3 text-sm text-ink/50 outline-none"
          />
          <span className="block text-xs text-ink/40 mt-1">
            Pra trocar o e-mail, use a aba Segurança.
          </span>
        </Campo>

        <Campo label="Telefone / WhatsApp">
          <input
            value={form.telefone}
            onChange={(e) => campo("telefone", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          />
        </Campo>

        <Campo label="CPF">
          <input
            value={form.cpf}
            onChange={(e) => campo("cpf", formatarCpf(e.target.value))}
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          />
          <span className="block text-[11px] text-ink/40 mt-1">
            Necessário pra pagar por Pix no Mercado Pago.
          </span>
        </Campo>

        <Campo label="Data de aniversário (opcional)">
          <input
            type="date"
            value={form.aniversario}
            onChange={(e) => campo("aniversario", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          />
        </Campo>

        <button
          type="submit"
          disabled={salvando}
          className="w-full bg-pine text-paper py-3.5 rounded-full text-sm mt-2 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {salvo && (
          <p className="text-center text-xs text-pine">Dados salvos ✓</p>
        )}
        {erro && <p className="text-center text-xs text-berry">{erro}</p>}
      </form>
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
