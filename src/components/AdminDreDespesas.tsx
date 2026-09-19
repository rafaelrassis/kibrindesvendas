"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIAS_DESPESA } from "@/lib/dre";
import type { Despesa } from "@/lib/data/despesas";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminDreDespesas({
  despesas,
  mes,
}: {
  despesas: Despesa[];
  mes: string;
}) {
  const router = useRouter();
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_DESPESA[0]);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(`${mes}-01`);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);

    const r = await fetch("/api/admin/despesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data,
        descricao,
        categoria,
        valor: Number(valor.replace(",", ".")),
      }),
    }).catch(() => null);

    setSalvando(false);

    if (!r?.ok) {
      const dados = await r?.json().catch(() => null);
      setErro(dados?.error ?? "Não foi possível salvar a despesa.");
      return;
    }

    setDescricao("");
    setValor("");
    router.refresh();
  }

  async function remover(id: string) {
    const r = await fetch(`/api/admin/despesas/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) {
      setErro("Não foi possível remover a despesa.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5 print:hidden">
      <p className="text-sm font-medium mb-3">Despesas operacionais do mês</p>

      <form onSubmit={adicionar} className="grid grid-cols-2 gap-2 mb-4">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição"
          aria-label="Descrição"
          className="col-span-2 border border-line rounded px-3 py-2 text-sm"
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          aria-label="Categoria"
          className="border border-line rounded px-3 py-2 text-sm bg-white"
        >
          {CATEGORIAS_DESPESA.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value.replace(".", ","))}
          inputMode="decimal"
          placeholder="Valor (R$)"
          aria-label="Valor"
          className="border border-line rounded px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-label="Data"
          className="border border-line rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={salvando}
          className="px-4 py-2 rounded bg-pine text-white text-sm disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Adicionar"}
        </button>
      </form>
      {erro && <p className="text-xs text-berry mb-3">{erro}</p>}

      {despesas.length === 0 ? (
        <p className="text-sm text-ink/50 text-center py-4">Nenhuma despesa lançada neste mês.</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {despesas.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{d.descricao}</p>
                <p className="text-xs text-ink/50">
                  {d.data.split("-").reverse().join("/")} · {d.categoria}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono">{reais(d.valor)}</span>
                <button
                  onClick={() => remover(d.id)}
                  aria-label={`Remover ${d.descricao}`}
                  className="text-xs text-berry"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
