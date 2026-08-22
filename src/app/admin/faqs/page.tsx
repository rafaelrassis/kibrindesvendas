"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import type { FaqAdmin } from "@/lib/types";

export default function AdminFaqsPage() {
  const [faqs, setFaqs] = useState<FaqAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [criando, setCriando] = useState(false);
  const [perguntaNova, setPerguntaNova] = useState("");
  const [respostaNova, setRespostaNova] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [perguntaEdicao, setPerguntaEdicao] = useState("");
  const [respostaEdicao, setRespostaEdicao] = useState("");

  useEffect(() => {
    fetch("/api/admin/faqs")
      .then((r) => r.json())
      .then((lista) => setFaqs(Array.isArray(lista) ? lista : []))
      .finally(() => setCarregando(false));
  }, []);

  async function alternarAtivo(faq: FaqAdmin) {
    setErro("");
    const r = await fetch(`/api/admin/faqs/${faq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !faq.ativo }),
    });
    if (!r.ok) {
      setErro("Não foi possível mudar a visibilidade da pergunta.");
      return;
    }
    setFaqs((prev) => prev.map((f) => (f.id === faq.id ? { ...f, ativo: !f.ativo } : f)));
  }

  // A tela troca dois vizinhos e manda a lista inteira na ordem nova; o
  // servidor renumera de uma vez. Se falhar, volta pra ordem de antes.
  async function mover(index: number, direcao: -1 | 1) {
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= faqs.length) return;

    const anterior = faqs;
    const nova = [...faqs];
    [nova[index], nova[alvo]] = [nova[alvo], nova[index]];
    setFaqs(nova);
    setErro("");

    const r = await fetch("/api/admin/faqs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: nova.map((f) => f.id) }),
    });
    if (!r.ok) {
      setFaqs(anterior);
      setErro("Não foi possível salvar a nova ordem.");
    }
  }

  async function remover(id: string) {
    setErro("");
    const r = await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErro("Não foi possível remover a pergunta.");
      return;
    }
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  }

  async function criar() {
    setErro("");
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: perguntaNova, resposta: respostaNova }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível criar a pergunta.");
        return;
      }
      const nova = await r.json();
      setFaqs((prev) => [...prev, nova]);
      setCriando(false);
      setPerguntaNova("");
      setRespostaNova("");
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(f: FaqAdmin) {
    setEditandoId(f.id);
    setPerguntaEdicao(f.pergunta);
    setRespostaEdicao(f.resposta);
  }

  async function salvarEdicao(id: string) {
    setErro("");
    setSalvando(true);
    try {
      const r = await fetch(`/api/admin/faqs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: perguntaEdicao, resposta: respostaEdicao }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível salvar a pergunta.");
        return;
      }
      const atualizada = await r.json();
      setFaqs((prev) => prev.map((f) => (f.id === id ? atualizada : f)));
      setEditandoId(null);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Suporte / FAQ</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna — perguntas e respostas mostradas em /suporte.
      </p>
      <AdminNav />

      <button
        onClick={() => setCriando((v) => !v)}
        className="inline-block bg-pine text-white px-5 py-2.5 rounded-full text-sm mb-6 hover:brightness-110 transition"
      >
        {criando ? "Cancelar" : "+ Nova pergunta"}
      </button>

      {criando && (
        <div className="bg-white border border-line rounded-lg p-4 mb-6 space-y-3">
          <div>
            <label className="text-xs text-ink/60 block mb-1">Pergunta</label>
            <input
              value={perguntaNova}
              onChange={(e) => setPerguntaNova(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-ink/60 block mb-1">Resposta</label>
            <textarea
              value={respostaNova}
              onChange={(e) => setRespostaNova(e.target.value)}
              rows={3}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={criar}
            disabled={salvando || !perguntaNova.trim() || !respostaNova.trim()}
            className="text-sm bg-pine text-white px-4 py-2 rounded-full disabled:opacity-40"
          >
            {salvando ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      )}

      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}
      {carregando && <p className="text-ink/50 text-sm">Carregando...</p>}
      {!carregando && faqs.length === 0 && (
        <p className="text-ink/50 text-sm">
          Nenhuma pergunta cadastrada — a página /suporte fica sem FAQ até você criar a primeira.
        </p>
      )}

      <div className="space-y-3">
        {faqs.map((f, i) => (
          <div
            key={f.id}
            className={`bg-white border border-line rounded-lg p-4 ${f.ativo ? "" : "opacity-50"}`}
          >
            {editandoId === f.id ? (
              <div className="space-y-2">
                <input
                  value={perguntaEdicao}
                  onChange={(e) => setPerguntaEdicao(e.target.value)}
                  className="w-full border border-line rounded px-3 py-1.5 text-sm font-medium"
                />
                <textarea
                  value={respostaEdicao}
                  onChange={(e) => setRespostaEdicao(e.target.value)}
                  rows={3}
                  className="w-full border border-line rounded px-3 py-1.5 text-sm"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => salvarEdicao(f.id)}
                    disabled={salvando}
                    className="text-xs bg-pine text-white px-3 py-1.5 rounded-full disabled:opacity-40"
                  >
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="text-xs text-ink/50 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{f.pergunta}</p>
                  <p className="text-sm text-ink/60 mt-1">{f.resposta}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <button
                      onClick={() => alternarAtivo(f)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        f.ativo ? "bg-mustard/20 text-pine" : "bg-ink/5 text-ink/50"
                      }`}
                    >
                      {f.ativo ? "Ativa" : "Inativa"}
                    </button>
                    <button
                      onClick={() => abrirEdicao(f)}
                      className="text-xs text-ink/50 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remover(f.id)}
                      className="text-xs text-berry hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir pergunta"
                    className="text-xs text-ink/50 disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => mover(i, 1)}
                    disabled={i === faqs.length - 1}
                    aria-label="Descer pergunta"
                    className="text-xs text-ink/50 disabled:opacity-20"
                  >
                    ▼
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
