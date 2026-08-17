"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";

type Categoria = { slug: string; label: string; emoji: string };

function slugify(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", emoji: "" });

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

  const salvar = () => {
    if (!form.label.trim()) return;

    if (emEdicao === "__novo__") {
      const novaSlug = slugify(form.label);
      setCategorias((prev) => [
        ...prev,
        { slug: novaSlug, label: form.label.trim(), emoji: form.emoji || "🎁" },
      ]);
    } else {
      setCategorias((prev) =>
        prev.map((c) =>
          c.slug === emEdicao ? { ...c, label: form.label.trim(), emoji: form.emoji || "🎁" } : c
        )
      );
    }
    cancelar();
  };

  const remover = (slug: string) => {
    setCategorias((prev) => prev.filter((c) => c.slug !== slug));
    if (emEdicao === slug) cancelar();
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Categorias</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna (mock) — alterações ficam só nesta sessão, não persistem no servidor ainda.
      </p>
      <AdminNav />

      <div className="bg-white border border-line rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
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
                        className="bg-pine text-white px-3 py-1.5 rounded-full text-xs"
                      >
                        Salvar
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
                      className="bg-pine text-white px-3 py-1.5 rounded-full text-xs"
                    >
                      Adicionar
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
