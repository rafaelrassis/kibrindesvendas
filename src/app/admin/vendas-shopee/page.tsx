"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "@/components/AdminNav";
import type { ProdutoAdmin } from "@/lib/types";
import { gerarCombinacoes, buildCombinacaoKey } from "@/lib/estoque-variacao";

type VendaShopee = {
  id: string;
  produtoId: string;
  produtoNome: string;
  combinacao: string | null;
  quantidade: number;
  valorVenda: number;
  custoTotal: number;
  comissaoPct: number;
  fretePct: number;
  adsPct: number;
  taxasValor: number;
  lucro: number;
  createdAt: string;
};

function reais(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// Estado editável de margens/quantidade/valor — usado tanto pro form de
// lançamento novo quanto pra edição inline de um item da lista.
type FormState = {
  produtoId: string;
  combinacao: string;
  quantidade: string;
  valorVenda: string;
  comissaoPct: string;
  fretePct: string;
  adsPct: string;
};

const FORM_VAZIO: FormState = {
  produtoId: "",
  combinacao: "",
  quantidade: "1",
  valorVenda: "",
  comissaoPct: "",
  fretePct: "",
  adsPct: "",
};

export default function AdminVendasShopeePage() {
  const [produtos, setProdutos] = useState<ProdutoAdmin[]>([]);
  const [vendas, setVendas] = useState<VendaShopee[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEdicao, setFormEdicao] = useState<FormState>(FORM_VAZIO);

  function carregar() {
    setCarregando(true);
    Promise.all([
      fetch("/api/admin/produtos").then((r) => r.json()),
      fetch("/api/admin/vendas-shopee").then((r) => r.json()),
    ])
      .then(([produtosRes, vendasRes]) => {
        setProdutos(Array.isArray(produtosRes) ? produtosRes : []);
        setVendas(Array.isArray(vendasRes) ? vendasRes : []);
      })
      .catch(() => setErro("Não foi possível carregar os dados."))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/produtos").then((r) => r.json()),
      fetch("/api/admin/vendas-shopee").then((r) => r.json()),
    ])
      .then(([produtosRes, vendasRes]) => {
        setProdutos(Array.isArray(produtosRes) ? produtosRes : []);
        setVendas(Array.isArray(vendasRes) ? vendasRes : []);
      })
      .catch(() => setErro("Não foi possível carregar os dados."))
      .finally(() => setCarregando(false));
  }, []);

  const produtoSelecionado = useMemo(
    () => produtos.find((p) => p.id === form.produtoId) ?? null,
    [produtos, form.produtoId]
  );

  const combinacoes = useMemo(() => {
    if (!produtoSelecionado || produtoSelecionado.variacoes.length === 0) return [];
    return gerarCombinacoes(produtoSelecionado.variacoes).map((sel) => ({
      chave: buildCombinacaoKey(sel),
      label: Object.entries(sel)
        .map(([tipo, valor]) => `${tipo}: ${valor}`)
        .join(" · "),
    }));
  }, [produtoSelecionado]);

  // Busca as margens efetivas (override do produto ou default global) pra
  // pré-preencher o form assim que um produto é escolhido — o admin só edita
  // se quiser corrigir algo especificamente nesta venda.
  async function selecionarProduto(produtoId: string) {
    setForm((f) => ({ ...f, produtoId, combinacao: "" }));
    if (!produtoId) return;
    try {
      const margens = await fetch(`/api/admin/vendas-shopee/margens/${produtoId}`).then((r) =>
        r.json()
      );
      setForm((f) => ({
        ...f,
        produtoId,
        comissaoPct: String(margens.comissaoPct ?? 0),
        fretePct: String(margens.fretePct ?? 0),
        adsPct: String(margens.adsPct ?? 0),
      }));
    } catch {
      // Sem as margens, o admin ainda consegue digitar na mão.
    }
  }

  // Preview de custo/lucro calculado no cliente só pra exibição — o valor
  // que vale de verdade é sempre recalculado no servidor ao salvar.
  const previewCusto = useMemo(() => {
    if (!produtoSelecionado) return 0;
    if (!form.combinacao) return produtoSelecionado.custoTotal;
    const sel: Record<string, string> = {};
    for (const par of form.combinacao.split("|")) {
      const [tipo, valor] = par.split(":");
      if (tipo && valor) sel[tipo] = valor;
    }
    for (const v of produtoSelecionado.variacoes) {
      const valor = sel[v.tipo];
      if (valor && v.custosValores?.[valor] != null) return v.custosValores[valor];
    }
    return produtoSelecionado.custoTotal;
  }, [produtoSelecionado, form.combinacao]);

  const qtd = Number(form.quantidade) || 0;
  const valorVenda = Number(form.valorVenda.replace(",", ".")) || 0;
  const custoTotalPreview = Math.round(previewCusto * qtd * 100) / 100;
  const pctTotal =
    (Number(form.comissaoPct) || 0) + (Number(form.fretePct) || 0) + (Number(form.adsPct) || 0);
  const taxasPreview = Math.round(valorVenda * (pctTotal / 100) * 100) / 100;
  const lucroPreview = Math.round((valorVenda - custoTotalPreview - taxasPreview) * 100) / 100;

  async function salvarVenda() {
    setErro("");
    if (!form.produtoId) {
      setErro("Escolha um produto.");
      return;
    }
    setSalvando(true);
    try {
      const resp = await fetch("/api/admin/vendas-shopee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId: form.produtoId,
          combinacao: form.combinacao || null,
          quantidade: Number(form.quantidade),
          valorVenda: Number(form.valorVenda.replace(",", ".")),
          comissaoPct: Number(form.comissaoPct) || 0,
          fretePct: Number(form.fretePct) || 0,
          adsPct: Number(form.adsPct) || 0,
        }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.error || "Erro ao salvar.");
      setForm(FORM_VAZIO);
      setMostrarForm(false);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(v: VendaShopee) {
    setEditandoId(v.id);
    setFormEdicao({
      produtoId: v.produtoId,
      combinacao: v.combinacao ?? "",
      quantidade: String(v.quantidade),
      valorVenda: String(v.valorVenda),
      comissaoPct: String(v.comissaoPct),
      fretePct: String(v.fretePct),
      adsPct: String(v.adsPct),
    });
  }

  async function salvarEdicao(id: string) {
    setErro("");
    try {
      const resp = await fetch(`/api/admin/vendas-shopee/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantidade: Number(formEdicao.quantidade),
          valorVenda: Number(formEdicao.valorVenda.replace(",", ".")),
          comissaoPct: Number(formEdicao.comissaoPct) || 0,
          fretePct: Number(formEdicao.fretePct) || 0,
          adsPct: Number(formEdicao.adsPct) || 0,
        }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.error || "Erro ao salvar.");
      setEditandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta venda? Não dá pra desfazer.")) return;
    try {
      const resp = await fetch(`/api/admin/vendas-shopee/${id}`, { method: "DELETE" });
      if (!resp.ok) {
        const dados = await resp.json();
        throw new Error(dados.error || "Erro ao excluir.");
      }
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  const totais = useMemo(() => {
    const vendido = vendas.reduce((s, v) => s + v.valorVenda, 0);
    const custo = vendas.reduce((s, v) => s + v.custoTotal + v.taxasValor, 0);
    const lucro = vendas.reduce((s, v) => s + v.lucro, 0);
    return { vendido, custo, lucro };
  }, [vendas]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Vendas Shopee</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Lance vendas feitas fora do site usando o custo já cadastrado no produto.
      </p>
      <AdminNav />

      {erro && <p className="text-sm text-berry mb-3">{erro}</p>}

      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <div className="border border-line rounded p-2">
          <div className="text-[10px] text-gray-500">Vendido</div>
          <div className="text-sm font-bold">{reais(totais.vendido)}</div>
        </div>
        <div className="border border-line rounded p-2">
          <div className="text-[10px] text-gray-500">Custo+taxas</div>
          <div className="text-sm font-bold text-berry">{reais(totais.custo)}</div>
        </div>
        <div className="border border-line rounded p-2 bg-paper-2">
          <div className="text-[10px] text-gray-500">Lucro</div>
          <div className="text-sm font-bold text-pine">{reais(totais.lucro)}</div>
        </div>
      </div>

      {!mostrarForm && (
        <button
          onClick={() => setMostrarForm(true)}
          className="w-full bg-pine text-white text-sm font-semibold rounded py-2.5 mb-4"
        >
          + Nova venda Shopee
        </button>
      )}

      {mostrarForm && (
        <div className="border border-line rounded-md p-3 space-y-3 mb-4">
          <div>
            <label className="text-xs font-semibold block mb-1">Produto</label>
            <select
              className="w-full border border-line rounded px-3 py-2 text-sm"
              value={form.produtoId}
              onChange={(e) => selecionarProduto(e.target.value)}
            >
              <option value="">Selecione…</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {combinacoes.length > 0 && (
            <div>
              <label className="text-xs font-semibold block mb-1">Variação</label>
              <select
                className="w-full border border-line rounded px-3 py-2 text-sm"
                value={form.combinacao}
                onChange={(e) => setForm((f) => ({ ...f, combinacao: e.target.value }))}
              >
                <option value="">Selecione…</option>
                {combinacoes.map((c) => (
                  <option key={c.chave} value={c.chave}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold block mb-1">Quantidade</label>
              <input
                type="number"
                min={1}
                className="w-full border border-line rounded px-3 py-2 text-sm"
                value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Valor vendido (R$)</label>
              <input
                inputMode="decimal"
                className="w-full border border-line rounded px-3 py-2 text-sm"
                value={form.valorVenda}
                onChange={(e) => setForm((f) => ({ ...f, valorVenda: e.target.value }))}
              />
            </div>
          </div>

          <div className="bg-paper-2 rounded p-2 space-y-2">
            <div className="text-[10px] font-semibold text-gray-500">
              MARGENS (edite se precisar corrigir só nesta venda)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] block mb-1">Comissão %</label>
                <input
                  inputMode="decimal"
                  className="w-full border border-line rounded px-2 py-1.5 text-sm"
                  value={form.comissaoPct}
                  onChange={(e) => setForm((f) => ({ ...f, comissaoPct: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] block mb-1">Frete %</label>
                <input
                  inputMode="decimal"
                  className="w-full border border-line rounded px-2 py-1.5 text-sm"
                  value={form.fretePct}
                  onChange={(e) => setForm((f) => ({ ...f, fretePct: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] block mb-1">Ads %</label>
                <input
                  inputMode="decimal"
                  className="w-full border border-line rounded px-2 py-1.5 text-sm"
                  value={form.adsPct}
                  onChange={(e) => setForm((f) => ({ ...f, adsPct: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {form.produtoId && (
            <div className="text-xs space-y-1 border-t border-line pt-2">
              <div className="flex justify-between">
                <span>Custo material</span>
                <span>{reais(custoTotalPreview)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxas ({pctTotal}%)</span>
                <span className="text-berry">{reais(taxasPreview)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Lucro líquido</span>
                <span className="text-pine">{reais(lucroPreview)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={salvarVenda}
              disabled={salvando}
              className="flex-1 bg-pine text-white text-sm font-semibold rounded py-2 disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar venda"}
            </button>
            <button
              onClick={() => {
                setMostrarForm(false);
                setForm(FORM_VAZIO);
              }}
              className="px-4 text-sm border border-line rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <h2 className="text-sm font-bold mb-2">Lançamentos</h2>
      {carregando ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : vendas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma venda lançada ainda.</p>
      ) : (
        <div className="space-y-2">
          {vendas.map((v) =>
            editandoId === v.id ? (
              <div key={v.id} className="border border-line rounded p-3 space-y-2">
                <div className="text-sm font-semibold">{v.produtoNome}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    className="border border-line rounded px-2 py-1.5 text-sm"
                    value={formEdicao.quantidade}
                    onChange={(e) =>
                      setFormEdicao((f) => ({ ...f, quantidade: e.target.value }))
                    }
                    placeholder="Quantidade"
                  />
                  <input
                    inputMode="decimal"
                    className="border border-line rounded px-2 py-1.5 text-sm"
                    value={formEdicao.valorVenda}
                    onChange={(e) =>
                      setFormEdicao((f) => ({ ...f, valorVenda: e.target.value }))
                    }
                    placeholder="Valor vendido"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    inputMode="decimal"
                    className="border border-line rounded px-2 py-1.5 text-sm"
                    value={formEdicao.comissaoPct}
                    onChange={(e) =>
                      setFormEdicao((f) => ({ ...f, comissaoPct: e.target.value }))
                    }
                    placeholder="Comissão %"
                  />
                  <input
                    inputMode="decimal"
                    className="border border-line rounded px-2 py-1.5 text-sm"
                    value={formEdicao.fretePct}
                    onChange={(e) => setFormEdicao((f) => ({ ...f, fretePct: e.target.value }))}
                    placeholder="Frete %"
                  />
                  <input
                    inputMode="decimal"
                    className="border border-line rounded px-2 py-1.5 text-sm"
                    value={formEdicao.adsPct}
                    onChange={(e) => setFormEdicao((f) => ({ ...f, adsPct: e.target.value }))}
                    placeholder="Ads %"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => salvarEdicao(v.id)}
                    className="flex-1 bg-pine text-white text-sm font-semibold rounded py-1.5"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="px-4 text-sm border border-line rounded"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div key={v.id} className="border border-line rounded p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{v.produtoNome}</div>
                  <div className="text-[11px] text-gray-500">
                    {v.combinacao ? `${v.combinacao} · ` : ""}
                    {v.quantidade}un · {formatarData(v.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{reais(v.valorVenda)}</div>
                  <div className="text-[11px] text-pine">lucro {reais(v.lucro)}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => iniciarEdicao(v)}
                    className="text-[10px] px-2 py-1 border border-line rounded"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => excluir(v.id)}
                    className="text-[10px] px-2 py-1 border border-line rounded text-berry"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
