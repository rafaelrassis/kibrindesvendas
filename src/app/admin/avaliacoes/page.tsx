"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";

type AvaliacaoAdmin = {
  id: string;
  nota: number;
  comentario: string | null;
  aprovado: boolean;
  createdAt: string;
  autor: string;
  produto: { id: string; nome: string };
};

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="text-mustard text-sm leading-none">
      {"★".repeat(nota)}
      <span className="text-ink/20">{"★".repeat(5 - nota)}</span>
    </span>
  );
}

export default function AdminAvaliacoesPage() {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [apenasPendentes, setApenasPendentes] = useState(true);

  useEffect(() => {
    fetch("/api/admin/avaliacoes")
      .then((r) => r.json())
      .then((lista) => setAvaliacoes(Array.isArray(lista) ? lista : []))
      .finally(() => setCarregando(false));
  }, []);

  async function definirAprovacao(id: string, aprovado: boolean) {
    setErro("");
    const r = await fetch(`/api/admin/avaliacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprovado }),
    });
    if (!r.ok) {
      setErro("Não foi possível atualizar a avaliação.");
      return;
    }
    setAvaliacoes((prev) => prev.map((a) => (a.id === id ? { ...a, aprovado } : a)));
  }

  async function remover(id: string) {
    setErro("");
    const r = await fetch(`/api/admin/avaliacoes/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErro("Não foi possível remover a avaliação.");
      return;
    }
    setAvaliacoes((prev) => prev.filter((a) => a.id !== id));
  }

  const lista = apenasPendentes ? avaliacoes.filter((a) => !a.aprovado) : avaliacoes;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Avaliações</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna — reviews de clientes aguardando ou já publicadas na loja.
      </p>
      <AdminNav />

      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setApenasPendentes(true)}
          className={`text-xs px-3 py-1.5 rounded-full ${
            apenasPendentes ? "bg-pine text-white" : "bg-ink/5 text-ink/60"
          }`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setApenasPendentes(false)}
          className={`text-xs px-3 py-1.5 rounded-full ${
            !apenasPendentes ? "bg-pine text-white" : "bg-ink/5 text-ink/60"
          }`}
        >
          Todas
        </button>
      </div>

      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}
      {carregando && <p className="text-ink/50 text-sm">Carregando...</p>}
      {!carregando && lista.length === 0 && (
        <p className="text-ink/50 text-sm">Nenhuma avaliação por aqui.</p>
      )}

      <div className="space-y-3">
        {lista.map((a) => (
          <div key={a.id} className="bg-white border border-line rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">{a.produto.nome}</p>
              <span className="text-xs text-ink/40">
                {new Date(a.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <Estrelas nota={a.nota} />
            {a.comentario && <p className="text-sm text-ink/70 mt-2">{a.comentario}</p>}
            <p className="text-xs text-ink/40 mt-2">{a.autor}</p>

            <div className="flex items-center gap-4 mt-3">
              {!a.aprovado ? (
                <button
                  onClick={() => definirAprovacao(a.id, true)}
                  className="text-xs text-pine hover:underline"
                >
                  Aprovar
                </button>
              ) : (
                <button
                  onClick={() => definirAprovacao(a.id, false)}
                  className="text-xs text-ink/50 hover:underline"
                >
                  Despublicar
                </button>
              )}
              <button onClick={() => remover(a.id)} className="text-xs text-berry hover:underline">
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
