"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, Produto } from "@/lib/types";

type VariacaoForm = { tipo: string; valores: string };

function paraVariacaoForm(v: Produto["variacoes"]): VariacaoForm[] {
  return v.map((x) => ({ tipo: x.tipo, valores: x.valores.join(", ") }));
}

export default function AdminProdutoForm({ produto }: { produto?: Produto }) {
  const router = useRouter();
  const editando = !!produto;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [categoriaSlug, setCategoriaSlug] = useState(produto?.categoria ?? "");
  const [preco, setPreco] = useState(produto?.preco?.toString() ?? "");
  const [precoShopee, setPrecoShopee] = useState(produto?.precoShopee?.toString() ?? "");
  const [vendidoNaShopee, setVendidoNaShopee] = useState(produto?.vendidoNaShopee ?? true);
  const [emoji, setEmoji] = useState(produto?.emoji ?? "🎁");
  const [cor, setCor] = useState(produto?.cor ?? "#3F6B4C");
  const [requerPersonalizacao, setRequerPersonalizacao] = useState(
    produto?.requerPersonalizacao ?? false
  );
  const [destaque, setDestaque] = useState(produto?.destaque ?? false);
  const [variacoes, setVariacoes] = useState<VariacaoForm[]>(
    produto ? paraVariacaoForm(produto.variacoes) : []
  );
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((cs: Categoria[]) => {
        setCategorias(cs);
        if (!categoriaSlug && cs[0]) setCategoriaSlug(cs[0].slug);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function atualizarVariacao(i: number, campo: keyof VariacaoForm, valor: string) {
    setVariacoes((prev) => prev.map((v, idx) => (idx === i ? { ...v, [campo]: valor } : v)));
  }

  function removerVariacao(i: number) {
    setVariacoes((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!nome.trim() || !categoriaSlug || !preco) {
      setErro("Preencha nome, categoria e preço.");
      return;
    }

    const payload = {
      nome,
      descricao,
      categoriaSlug,
      preco: Number(preco),
      precoShopee: precoShopee ? Number(precoShopee) : Number(preco),
      vendidoNaShopee,
      requerPersonalizacao,
      emoji,
      cor,
      destaque,
      variacoes: variacoes
        .filter((v) => v.tipo.trim())
        .map((v) => ({
          tipo: v.tipo.trim(),
          valores: v.valores.split(",").map((x) => x.trim()).filter(Boolean),
        })),
    };

    setEnviando(true);
    const r = await fetch(
      editando ? `/api/admin/produtos/${produto!.id}` : "/api/admin/produtos",
      {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await r.json();
    setEnviando(false);

    if (!r.ok) {
      setErro(data.error ?? "Não foi possível salvar.");
      return;
    }
    router.push("/admin/produtos");
  }

  return (
    <form onSubmit={enviar} className="space-y-4 max-w-xl">
      <Campo label="Nome">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          required
        />
      </Campo>

      <Campo label="Descrição">
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          rows={3}
        />
      </Campo>

      <Campo label="Categoria">
        <select
          value={categoriaSlug}
          onChange={(e) => setCategoriaSlug(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
        >
          {categorias.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Preço (site)">
          <input
            type="number"
            step="0.01"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 text-sm"
            required
          />
        </Campo>
        <Campo label="Preço (Shopee)">
          <input
            type="number"
            step="0.01"
            value={precoShopee}
            onChange={(e) => setPrecoShopee(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 text-sm"
            placeholder="opcional"
          />
        </Campo>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={vendidoNaShopee}
            onChange={(e) => setVendidoNaShopee(e.target.checked)}
          />
          Também vendido na Shopee
        </label>
        <p className="text-xs text-ink/50 mt-1">
          Desligado, o site nunca mostra o comparativo de preço deste produto, mesmo com
          o preço da Shopee preenchido.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Emoji">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-full border border-line rounded px-3 py-2 text-sm"
            maxLength={4}
          />
        </Campo>
        <Campo label="Cor">
          <input
            type="color"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            className="w-full border border-line rounded px-3 py-1 h-10"
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={requerPersonalizacao}
          onChange={(e) => setRequerPersonalizacao(e.target.checked)}
        />
        Requer personalização
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={destaque}
          onChange={(e) => setDestaque(e.target.checked)}
        />
        Produto em destaque
      </label>

      <div>
        <p className="text-sm font-medium mb-2">Variações</p>
        <div className="space-y-2">
          {variacoes.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={v.tipo}
                onChange={(e) => atualizarVariacao(i, "tipo", e.target.value)}
                placeholder="Tipo (ex: Tamanho)"
                className="w-1/3 border border-line rounded px-3 py-2 text-sm"
              />
              <input
                value={v.valores}
                onChange={(e) => atualizarVariacao(i, "valores", e.target.value)}
                placeholder="Valores separados por vírgula"
                className="flex-1 border border-line rounded px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removerVariacao(i)}
                className="text-berry text-xs px-2"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setVariacoes((prev) => [...prev, { tipo: "", valores: "" }])}
          className="text-pine text-xs mt-2 hover:underline"
        >
          + Adicionar variação
        </button>
      </div>

      {erro && <p className="text-sm text-berry">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="bg-pine text-white px-6 py-2.5 rounded-full text-sm disabled:opacity-50"
      >
        {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Criar produto"}
      </button>
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
