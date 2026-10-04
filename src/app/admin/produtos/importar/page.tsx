"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

type Novo = { url: string; nome: string };
type Categoria = { slug: string; label: string };

export default function ImportarFornecedorPage() {
  const [site, setSite] = useState("https://setemalhas.com");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoria, setCategoria] = useState("");
  const [margem, setMargem] = useState("0");
  const [buscando, setBuscando] = useState(false);
  const [resumo, setResumo] = useState<{ total: number; jaCadastrados: number } | null>(null);
  const [novos, setNovos] = useState<Novo[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);
  const [log, setLog] = useState<{ nome: string; ok: boolean; texto?: string }[]>([]);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => (r.ok ? r.json() : []))
      .then((c: Categoria[]) => {
        setCategorias(c);
        if (c[0]) setCategoria(c[0].slug);
      })
      .catch(() => {});
  }, []);

  async function buscar() {
    setErro("");
    setBuscando(true);
    setLog([]);
    const r = await fetch(`/api/admin/fornecedor/importar?site=${encodeURIComponent(site)}`);
    const data = await r.json();
    setBuscando(false);
    if (!r.ok) {
      setErro(data.error ?? "Não foi possível buscar.");
      return;
    }
    setResumo({ total: data.total, jaCadastrados: data.jaCadastrados });
    setNovos(data.novos);
    setMarcados(new Set(data.novos.map((n: Novo) => n.url)));
  }

  async function importar() {
    setImportando(true);
    setLog([]);
    for (const n of novos.filter((x) => marcados.has(x.url))) {
      const r = await fetch("/api/admin/fornecedor/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: n.url, categoriaSlug: categoria, margemPct: Number(margem) || 0 }),
      }).catch(() => null);
      const data = r ? await r.json().catch(() => ({})) : {};
      const ok = !!r?.ok && data.ok;
      setLog((l) => [...l, { nome: n.nome, ok, texto: ok ? undefined : (data.error ?? "Falhou.") }]);
      if (ok) {
        setNovos((lista) => lista.filter((x) => x.url !== n.url));
        setMarcados((m) => {
          const c = new Set(m);
          c.delete(n.url);
          return c;
        });
      }
    }
    setImportando(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Importar do fornecedor</h1>
      <p className="text-ink/60 text-sm mb-2">
        Traz os produtos do site do fornecedor que ainda não existem aqui. Entram{" "}
        <strong>pausados</strong>, com variações, fotos, link e espelhamento ligados.
      </p>
      <AdminNav />

      <div className="flex gap-2 mb-4">
        <input
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="flex-1 border border-line rounded px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando || importando}
          className="border border-line rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {buscando ? "Buscando…" : "Buscar produtos"}
        </button>
      </div>
      {erro && <p className="text-sm text-white bg-berry rounded px-3 py-2 mb-4">{erro}</p>}

      {resumo && (
        <>
          <p className="text-sm mb-3">
            {resumo.total} produto(s) no site · {resumo.jaCadastrados} já cadastrados aqui ·{" "}
            <strong>{novos.length} novos</strong>
          </p>

          {novos.length > 0 && (
            <>
              <div className="flex flex-wrap gap-3 mb-4 text-sm">
                <label className="flex items-center gap-2">
                  Categoria
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="border border-line rounded px-2 py-1"
                  >
                    {categorias.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Margem sobre o preço deles (%)
                  <input
                    type="number"
                    min={0}
                    value={margem}
                    onChange={(e) => setMargem(e.target.value)}
                    className="w-20 border border-line rounded px-2 py-1"
                  />
                </label>
              </div>

              <ul className="border border-line rounded divide-y divide-line mb-4">
                {novos.map((n) => (
                  <li key={n.url} className="px-3 py-2 text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={marcados.has(n.url)}
                      onChange={(e) =>
                        setMarcados((m) => {
                          const c = new Set(m);
                          if (e.target.checked) c.add(n.url);
                          else c.delete(n.url);
                          return c;
                        })
                      }
                    />
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {n.nome}
                    </a>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={importar}
                disabled={importando || marcados.size === 0 || !categoria}
                className="bg-ink text-white rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                {importando ? "Importando…" : `Importar ${marcados.size} produto(s)`}
              </button>
            </>
          )}
        </>
      )}

      {log.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {log.map((l, i) => (
            <li key={i} className={l.ok ? "text-pine-2" : "text-berry"}>
              {l.ok ? "✓" : "✗"} {l.nome}
              {l.texto && ` — ${l.texto}`}
            </li>
          ))}
          {!importando && (
            <li>
              <Link href="/admin/produtos" className="underline">
                Ver produtos
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
