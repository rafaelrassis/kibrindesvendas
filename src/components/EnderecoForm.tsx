"use client";

import { useState } from "react";
import type { Endereco } from "@/lib/conta-data";

type Props = {
  inicial: Endereco;
  onSalvar: (endereco: Endereco) => void;
  onExcluir?: () => void;
};

export default function EnderecoForm({ inicial, onSalvar, onExcluir }: Props) {
  const [form, setForm] = useState<Endereco>(inicial);

  function campo<K extends keyof Endereco>(chave: K, valor: Endereco[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar(form);
      }}
      className="space-y-4"
    >
      <Campo label="Identificação (ex: Casa, Trabalho)">
        <input
          value={form.rotulo}
          onChange={(e) => campo("rotulo", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </Campo>

      <Campo label="Destinatário">
        <input
          value={form.destinatario}
          onChange={(e) => campo("destinatario", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="CEP">
          <input
            value={form.cep}
            onChange={(e) => campo("cep", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>
        <Campo label="Número">
          <input
            value={form.numero}
            onChange={(e) => campo("numero", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>
      </div>

      <Campo label="Rua">
        <input
          value={form.rua}
          onChange={(e) => campo("rua", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </Campo>

      <Campo label="Complemento (opcional)">
        <input
          value={form.complemento}
          onChange={(e) => campo("complemento", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
        />
      </Campo>

      <Campo label="Bairro">
        <input
          value={form.bairro}
          onChange={(e) => campo("bairro", e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </Campo>

      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Campo label="Cidade">
          <input
            value={form.cidade}
            onChange={(e) => campo("cidade", e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </Campo>
        <Campo label="UF">
          <input
            value={form.uf}
            maxLength={2}
            onChange={(e) => campo("uf", e.target.value.toUpperCase())}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine uppercase"
            required
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2.5 text-sm pt-1">
        <input
          type="checkbox"
          checked={form.padrao}
          onChange={(e) => campo("padrao", e.target.checked)}
          className="w-4 h-4 accent-pine"
        />
        Usar como endereço padrão
      </label>

      <button
        type="submit"
        className="w-full bg-pine text-paper py-3.5 rounded-full text-sm mt-2"
      >
        Salvar endereço
      </button>

      {onExcluir && (
        <button
          type="button"
          onClick={onExcluir}
          className="w-full text-berry text-sm py-2"
        >
          Excluir endereço
        </button>
      )}
    </form>
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
