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
  criadoPorAdmin: boolean;
  produto: { id: string; nome: string };
};

type ProdutoOpcao = { id: string; nome: string };

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="text-mustard text-sm leading-none">
      {"★".repeat(nota)}
      <span className="text-ink/20">{"★".repeat(5 - nota)}</span>
    </span>
  );
}

// Seletor de 1 a 5 estrelas clicáveis — usado tanto pra criar quanto editar.
function SeletorNota({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-xl leading-none ${n <= valor ? "text-mustard" : "text-ink/20"}`}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function AdminAvaliacoesPage() {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAdmin[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [apenasPendentes, setApenasPendentes] = useState(true);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [notaEdicao, setNotaEdicao] = useState(5);
  const [comentarioEdicao, setComentarioEdicao] = useState("");
  const [autorEdicao, setAutorEdicao] = useState("");

  const [criando, setCriando] = useState(false);
  const [produtoNovo, setProdutoNovo] = useState("");
  const [notaNova, setNotaNova] = useState(5);
  const [autorNovo, setAutorNovo] = useState("");
  const [comentarioNovo, setComentarioNovo] = useState("");
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    fetch("/api/admin/avaliacoes")
      .then((r) => r.json())
      .then((lista) => setAvaliacoes(Array.isArray(lista) ? lista : []))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    fetch("/api/admin/avaliacoes")
      .then((r) => r.json())
      .then((lista) => setAvaliacoes(Array.isArray(lista) ? lista : []))
      .finally(() => setCarregando(false));
    fetch("/api/admin/produtos")
      .then((r) => r.json())
      .then((lista: ProdutoOpcao[]) => {
        setProdutos(Array.isArray(lista) ? lista : []);
        if (Array.isArray(lista) && lista[0]) setProdutoNovo(lista[0].id);
      });
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

  function abrirEdicao(a: AvaliacaoAdmin) {
    setEditandoId(a.id);
    setNotaEdicao(a.nota);
    setComentarioEdicao(a.comentario ?? "");
    setAutorEdicao(a.criadoPorAdmin ? a.autor : "");
  }

  async function salvarEdicao(id: string, criadoPorAdmin: boolean) {
    setErro("");
    setSalvando(true);
    try {
      const body: Record<string, unknown> = { nota: notaEdicao, comentario: comentarioEdicao };
      if (criadoPorAdmin) body.autorNome = autorEdicao;
      const r = await fetch(`/api/admin/avaliacoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível salvar a avaliação.");
        return;
      }
      setEditandoId(null);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function criarAvaliacao() {
    setErro("");
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/avaliacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId: produtoNovo,
          nota: notaNova,
          comentario: comentarioNovo,
          autorNome: autorNovo,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível criar a avaliação.");
        return;
      }
      setCriando(false);
      setAutorNovo("");
      setComentarioNovo("");
      setNotaNova(5);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  const lista = apenasPendentes ? avaliacoes.filter((a) => !a.aprovado) : avaliacoes;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Avaliações</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna — reviews de clientes aguardando ou já publicadas na loja.
      </p>
      <AdminNav />

      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
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
        <button
          onClick={() => setCriando((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-full bg-pine text-white"
        >
          {criando ? "Cancelar" : "+ Nova avaliação"}
        </button>
      </div>

      {criando && (
        <div className="bg-white border border-line rounded-lg p-4 mb-6 space-y-3">
          <p className="text-sm font-medium">Criar avaliação em nome da loja</p>
          <p className="text-xs text-ink/50">
            Publica direto, sem passar pela fila de moderação — use pra review que chegou por
            outro canal (WhatsApp, presencial etc).
          </p>
          <div>
            <label className="text-xs text-ink/60 block mb-1">Produto</label>
            <select
              value={produtoNovo}
              onChange={(e) => setProdutoNovo(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            >
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink/60 block mb-1">Nome do autor</label>
            <input
              value={autorNovo}
              onChange={(e) => setAutorNovo(e.target.value)}
              placeholder="Ex.: Maria S."
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-ink/60 block mb-1">Nota</label>
            <SeletorNota valor={notaNova} onChange={setNotaNova} />
          </div>
          <div>
            <label className="text-xs text-ink/60 block mb-1">Comentário (opcional)</label>
            <textarea
              value={comentarioNovo}
              onChange={(e) => setComentarioNovo(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={criarAvaliacao}
            disabled={salvando || !produtoNovo || !autorNovo.trim()}
            className="text-sm bg-pine text-white px-4 py-2 rounded-full disabled:opacity-40"
          >
            {salvando ? "Salvando..." : "Publicar avaliação"}
          </button>
        </div>
      )}

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

            {editandoId === a.id ? (
              <div className="space-y-2 mt-2">
                {a.criadoPorAdmin && (
                  <input
                    value={autorEdicao}
                    onChange={(e) => setAutorEdicao(e.target.value)}
                    placeholder="Nome do autor"
                    className="w-full border border-line rounded px-3 py-1.5 text-sm"
                  />
                )}
                <SeletorNota valor={notaEdicao} onChange={setNotaEdicao} />
                <textarea
                  value={comentarioEdicao}
                  onChange={(e) => setComentarioEdicao(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full border border-line rounded px-3 py-1.5 text-sm"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => salvarEdicao(a.id, a.criadoPorAdmin)}
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
              <>
                <Estrelas nota={a.nota} />
                {a.comentario && <p className="text-sm text-ink/70 mt-2">{a.comentario}</p>}
                <p className="text-xs text-ink/40 mt-2">
                  {a.autor}
                  {a.criadoPorAdmin && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide bg-mustard/20 text-pine-2 px-1.5 py-0.5 rounded-full">
                      Cadastrada pela loja
                    </span>
                  )}
                </p>

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
                  <button
                    onClick={() => abrirEdicao(a)}
                    className="text-xs text-ink/50 hover:underline"
                  >
                    Editar
                  </button>
                  <button onClick={() => remover(a.id)} className="text-xs text-berry hover:underline">
                    Remover
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
