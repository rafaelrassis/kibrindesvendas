"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";

type Categoria = { slug: string; label: string; emoji: string };

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", emoji: "" });

  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then(setCategorias);
  }, []);

  const iniciarNovo = () => {
    setEmEdicao("__novo__");
    setForm({ label: "", emoji: "🎁" });
  };

  const iniciarEdicao = (c: Categoria) => {
    setEmEdicao(c.slug);
    setForm({ label: c.label, emoji: c.emoji });
  };

  const cancelar = () => {
    setEmEdicao(null);
    setForm({ label: "", emoji: "" });
  };

  const salvar = async () => {
    if (!form.label.trim()) return;
    setErro("");
    setSalvando(true);

    try {
      if (emEdicao === "__novo__") {
        const r = await fetch("/api/admin/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const nova = await r.json();
        if (!r.ok) throw new Error(nova.error);
        setCategorias((prev) => [...prev, nova]);
      } else if (emEdicao) {
        const r = await fetch(`/api/admin/categorias/${emEdicao}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const atualizada = await r.json();
        if (!r.ok) throw new Error(atualizada.error);
        setCategorias((prev) => prev.map((c) => (c.slug === emEdicao ? atualizada : c)));
      }
      cancelar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (slug: string) => {
    setErro("");
    const r = await fetch(`/api/admin/categorias/${slug}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) {
      setErro(data.error ?? "Não foi possível remover.");
      return;
    }
    setCategorias((prev) => prev.filter((c) => c.slug !== slug));
    if (emEdicao === slug) cancelar();
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Categorias</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna — alterações são gravadas direto no banco.
      </p>
      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}
      <AdminNav />

      <div className="bg-white border border-line rounded-lg overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[420px]">
          <thead className="bg-paper-2 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Ícone</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.slug} className="border-t border-line">
                {emEdicao === c.slug ? (
                  <td colSpan={4} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={form.emoji}
                        onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                        className="w-14 border border-line rounded px-2 py-1.5 text-center"
                        maxLength={2}
                      />
                      <input
                        value={form.label}
                        onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                        className="flex-1 min-w-[160px] border border-line rounded px-2 py-1.5"
                        placeholder="Nome da categoria"
                      />
                      <button
                        onClick={salvar}
                        disabled={salvando}
                        className="bg-pine text-white px-3 py-1.5 rounded-full text-xs disabled:opacity-50"
                      >
                        {salvando ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        onClick={cancelar}
                        className="border border-line px-3 py-1.5 rounded-full text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 text-lg">{c.emoji}</td>
                    <td className="px-4 py-3">{c.label}</td>
                    <td className="px-4 py-3 text-ink/50 font-mono text-xs">{c.slug}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button
                        onClick={() => iniciarEdicao(c)}
                        className="text-pine hover:underline text-xs"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remover(c.slug)}
                        className="text-berry hover:underline text-xs"
                      >
                        Remover
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {emEdicao === "__novo__" && (
              <tr className="border-t border-line">
                <td colSpan={4} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={form.emoji}
                      onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                      className="w-14 border border-line rounded px-2 py-1.5 text-center"
                      maxLength={2}
                    />
                    <input
                      autoFocus
                      value={form.label}
                      onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                      className="flex-1 min-w-[160px] border border-line rounded px-2 py-1.5"
                      placeholder="Nome da nova categoria"
                    />
                    <button
                      onClick={salvar}
                      disabled={salvando}
                      className="bg-pine text-white px-3 py-1.5 rounded-full text-xs disabled:opacity-50"
                    >
                      {salvando ? "Salvando..." : "Adicionar"}
                    </button>
                    <button
                      onClick={cancelar}
                      className="border border-line px-3 py-1.5 rounded-full text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {emEdicao !== "__novo__" && (
        <button
          onClick={iniciarNovo}
          className="bg-pine text-white px-5 py-2.5 rounded-full text-sm hover:brightness-110 transition"
        >
          + Nova categoria
        </button>
      )}
    </div>
  );
}
