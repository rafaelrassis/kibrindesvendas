"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, ProdutoAdmin } from "@/lib/types";

type VariacaoForm = { tipo: string; valores: string };
type MaterialForm = { nome: string; quantidade: string; custoUnitario: string };

function paraVariacaoForm(v: ProdutoAdmin["variacoes"]): VariacaoForm[] {
  return v.map((x) => ({ tipo: x.tipo, valores: x.valores.join(", ") }));
}

function paraMaterialForm(m: ProdutoAdmin["materiais"] | undefined): MaterialForm[] {
  return (m ?? []).map((x) => ({
    nome: x.nome,
    quantidade: String(x.quantidade),
    custoUnitario: String(x.custoUnitario),
  }));
}

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export default function AdminProdutoForm({ produto }: { produto?: ProdutoAdmin }) {
  const router = useRouter();
  const editando = !!produto;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [descricaoDetalhada, setDescricaoDetalhada] = useState(
    produto?.descricaoDetalhada ?? ""
  );
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
  const [pesoGramas, setPesoGramas] = useState(String(produto?.pesoGramas ?? 300));
  const [alturaCm, setAlturaCm] = useState(String(produto?.alturaCm ?? 4));
  const [larguraCm, setLarguraCm] = useState(String(produto?.larguraCm ?? 11));
  const [comprimentoCm, setComprimentoCm] = useState(String(produto?.comprimentoCm ?? 16));
  const [variacoes, setVariacoes] = useState<VariacaoForm[]>(
    produto ? paraVariacaoForm(produto.variacoes) : []
  );
  const [materiais, setMateriais] = useState<MaterialForm[]>(paraMaterialForm(produto?.materiais));
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

  function atualizarMaterial(i: number, campo: keyof MaterialForm, valor: string) {
    setMateriais((prev) => prev.map((m, idx) => (idx === i ? { ...m, [campo]: valor } : m)));
  }

  function removerMaterial(i: number) {
    setMateriais((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Cálculo ao vivo, só pra guiar o cadastro — o valor de verdade é
  // recalculado no servidor a partir do que for salvo.
  const custoTotal = materiais.reduce((soma, m) => {
    const qtd = Number(m.quantidade.replace(",", "."));
    const custo = Number(m.custoUnitario.replace(",", "."));
    return soma + (Number.isFinite(qtd) && Number.isFinite(custo) ? qtd * custo : 0);
  }, 0);
  const precoNum = Number(preco.replace(",", ".")) || 0;
  const lucro = precoNum - custoTotal;
  const margem = precoNum > 0 ? (lucro / precoNum) * 100 : null;

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
      descricaoDetalhada: descricaoDetalhada.trim() || null,
      categoriaSlug,
      preco: Number(preco),
      precoShopee: precoShopee ? Number(precoShopee) : Number(preco),
      vendidoNaShopee,
      requerPersonalizacao,
      emoji,
      cor,
      destaque,
      pesoGramas: Number(pesoGramas) || 300,
      alturaCm: Number(alturaCm) || 4,
      larguraCm: Number(larguraCm) || 11,
      comprimentoCm: Number(comprimentoCm) || 16,
      variacoes: variacoes
        .filter((v) => v.tipo.trim())
        .map((v) => ({
          tipo: v.tipo.trim(),
          valores: v.valores.split(",").map((x) => x.trim()).filter(Boolean),
        })),
      materiais: materiais
        .filter((m) => m.nome.trim())
        .map((m) => ({
          nome: m.nome.trim(),
          quantidade: Number(m.quantidade.replace(",", ".")) || 0,
          custoUnitario: Number(m.custoUnitario.replace(",", ".")) || 0,
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

      <Campo label="Descrição detalhada">
        <textarea
          value={descricaoDetalhada}
          onChange={(e) => setDescricaoDetalhada(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          rows={5}
          placeholder="Materiais, medidas, cuidados, o que vem incluso... aparece numa seção própria na página do produto."
        />
        <p className="text-xs text-ink/50 mt-1">Opcional. Sem isso, a página mostra só a descrição curta.</p>
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

      <div>
        <p className="text-sm font-medium mb-2">Peso e dimensões (embalagem)</p>
        <p className="text-xs text-ink/50 mb-2">
          Usados na cotação real de frete pelos Correios. Sem esses dados o cálculo cai
          na estimativa por região.
        </p>
        <div className="grid grid-cols-4 gap-3">
          <Campo label="Peso (g)">
            <input
              type="number"
              min={1}
              value={pesoGramas}
              onChange={(e) => setPesoGramas(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Altura (cm)">
            <input
              type="number"
              min={1}
              value={alturaCm}
              onChange={(e) => setAlturaCm(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Largura (cm)">
            <input
              type="number"
              min={1}
              value={larguraCm}
              onChange={(e) => setLarguraCm(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
          <Campo label="Comprimento (cm)">
            <input
              type="number"
              min={1}
              value={comprimentoCm}
              onChange={(e) => setComprimentoCm(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </Campo>
        </div>
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

      <div className="border-t border-line pt-4">
        <p className="text-sm font-medium mb-1">Custo de material</p>
        <p className="text-xs text-ink/50 mb-3">
          Lance tudo que é gasto pra fazer o produto — assim dá pra ver a margem real, não só o
          preço de venda. Isso nunca aparece pro cliente, só aqui no admin.
        </p>
        <div className="space-y-2">
          {materiais.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={m.nome}
                onChange={(e) => atualizarMaterial(i, "nome", e.target.value)}
                placeholder="Material (ex: Caneca branca)"
                className="flex-1 border border-line rounded px-3 py-2 text-sm"
              />
              <input
                value={m.quantidade}
                onChange={(e) => atualizarMaterial(i, "quantidade", e.target.value)}
                placeholder="Qtd"
                inputMode="decimal"
                className="w-16 border border-line rounded px-2 py-2 text-sm"
              />
              <input
                value={m.custoUnitario}
                onChange={(e) => atualizarMaterial(i, "custoUnitario", e.target.value)}
                placeholder="Custo un."
                inputMode="decimal"
                className="w-24 border border-line rounded px-2 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removerMaterial(i)}
                className="text-berry text-xs px-2"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setMateriais((prev) => [...prev, { nome: "", quantidade: "1", custoUnitario: "" }])
          }
          className="text-pine text-xs mt-2 hover:underline"
        >
          + Adicionar material
        </button>

        <div className="bg-paper-2 border border-line rounded-lg p-4 mt-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-ink/60">Custo total de material</span>
            <span className="font-mono">{reais(custoTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">Lucro por unidade</span>
            <span className={`font-mono ${lucro < 0 ? "text-berry" : "text-pine-2"}`}>
              {reais(lucro)}
            </span>
          </div>
          {margem !== null && (
            <div className="flex justify-between">
              <span className="text-ink/60">Margem</span>
              <span className={`font-mono ${lucro < 0 ? "text-berry" : "text-pine-2"}`}>
                {margem.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
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

