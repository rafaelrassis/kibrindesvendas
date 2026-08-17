"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConta } from "@/lib/conta-context";
import type { Perfil } from "@/lib/conta-data";

export default function DadosPage() {
  const router = useRouter();
  const { perfil, atualizarPerfil } = useConta();
  const [form, setForm] = useState<Perfil>(perfil);
  const [salvo, setSalvo] = useState(false);

  function campo<K extends keyof Perfil>(chave: K, valor: Perfil[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
    setSalvo(false);
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    atualizarPerfil(form);
    setSalvo(true);
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
            onChange={(e) => campo("email", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
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
            onChange={(e) => campo("cpf", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          />
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
          className="w-full bg-pine text-paper py-3.5 rounded-full text-sm mt-2"
        >
          Salvar alterações
        </button>
        {salvo && (
          <p className="text-center text-xs text-pine">Dados salvos ✓</p>
        )}
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
