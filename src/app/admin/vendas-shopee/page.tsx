"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "@/components/AdminNav";
import type { ProdutoAdmin } from "@/lib/types";
import type { ConfiguracaoLoja } from "@/lib/data/configuracao";
import { gerarCombinacoes, buildCombinacaoKey } from "@/lib/estoque-variacao";

type TipoCampo = "percentual" | "valor";
type SinalCampo = "soma" | "subtrai";

type ValorShopee = {
  nome: string;
  tipo: TipoCampo;
  sinal: SinalCampo;
  valor: number;
};

type VendaShopee = {
  id: string;
  produtoId: string;
  produtoNome: string;
  combinacao: string | null;
  quantidade: number;
  valorVenda: number;
  custoTotal: number;
  valoresShopee: ValorShopee[];
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

// Estado editável de um campo do template dentro do form — valor em texto
// pra aceitar digitação livre, convertido ao salvar.
type CampoValorForm = {
  nome: string;
  tipo: TipoCampo;
  sinal: SinalCampo;
  valor: string;
};

// Estado editável de quantidade/valor/campos — usado tanto pro form de
// lançamento novo quanto pra edição inline de um item da lista.
type FormState = {
  produtoId: string;
  combinacao: string;
  quantidade: string;
  valorVenda: string;
  valoresShopee: CampoValorForm[];
};

const FORM_VAZIO: FormState = {
  produtoId: "",
  combinacao: "",
  quantidade: "1",
  valorVenda: "",
  valoresShopee: [],
};

function calcularValorCampo(campo: { tipo: TipoCampo; valor: number }, valorVenda: number) {
  return campo.tipo === "percentual" ? valorVenda * (campo.valor / 100) : campo.valor;
}

export default function AdminVendasShopeePage() {
  const [produtos, setProdutos] = useState<ProdutoAdmin[]>([]);
  const [vendas, setVendas] = useState<VendaShopee[]>([]);
  const [template, setTemplate] = useState<CampoValorForm[]>([]);
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
      fetch("/api/admin/configuracoes").then((r) => r.json()),
    ])
      .then(([produtosRes, vendasRes, config]: [unknown, unknown, ConfiguracaoLoja]) => {
        setProdutos(Array.isArray(produtosRes) ? produtosRes : []);
        setVendas(Array.isArray(vendasRes) ? vendasRes : []);
        setTemplate(
          config.camposMargemShopee.map((c) => ({
            nome: c.nome,
            tipo: c.tipo,
            sinal: c.sinal,
            valor: c.valorPadrao?.toString() ?? "",
          }))
        );
      })
      .catch(() => setErro("Não foi possível carregar os dados."))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/produtos").then((r) => r.json()),
      fetch("/api/admin/vendas-shopee").then((r) => r.json()),
      fetch("/api/admin/configuracoes").then((r) => r.json()),
    ])
      .then(([produtosRes, vendasRes, config]: [unknown, unknown, ConfiguracaoLoja]) => {
        setProdutos(Array.isArray(produtosRes) ? produtosRes : []);
        setVendas(Array.isArray(vendasRes) ? vendasRes : []);
        setTemplate(
          config.camposMargemShopee.map((c) => ({
            nome: c.nome,
            tipo: c.tipo,
            sinal: c.sinal,
            valor: c.valorPadrao?.toString() ?? "",
          }))
        );
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

  function abrirForm() {
    setForm({ ...FORM_VAZIO, valoresShopee: template.map((c) => ({ ...c })) });
    setMostrarForm(true);
  }

  function editarCampoForm(i: number, patch: Partial<CampoValorForm>) {
    setForm((f) => ({
      ...f,
      valoresShopee: f.valoresShopee.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));
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
  const camposPreview = useMemo(
    () =>
      form.valoresShopee.map((c) => ({
        ...c,
        valorCalculado: calcularValorCampo({ tipo: c.tipo, valor: Number(c.valor) || 0 }, valorVenda),
      })),
    [form.valoresShopee, valorVenda]
  );
  const taxasPreview =
    Math.round(
      camposPreview.filter((c) => c.sinal === "subtrai").reduce((s, c) => s + c.valorCalculado, 0) * 100
    ) / 100;
  const ajustePreview = camposPreview.reduce(
    (s, c) => s + (c.sinal === "subtrai" ? -c.valorCalculado : c.valorCalculado),
    0
  );
  const lucroPreview = Math.round((valorVenda - custoTotalPreview + ajustePreview) * 100) / 100;

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
          valoresShopee: form.valoresShopee.map((c) => ({
            nome: c.nome,
            tipo: c.tipo,
            sinal: c.sinal,
            valor: Number(c.valor.replace(",", ".")) || 0,
          })),
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
      valoresShopee: v.valoresShopee.map((c) => ({ ...c, valor: String(c.valor) })),
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
          valoresShopee: formEdicao.valoresShopee.map((c) => ({
            nome: c.nome,
            tipo: c.tipo,
            sinal: c.sinal,
            valor: Number(c.valor.replace(",", ".")) || 0,
          })),
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
          onClick={abrirForm}
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
              onChange={(e) => setForm((f) => ({ ...f, produtoId: e.target.value, combinacao: "" }))}
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

          {form.valoresShopee.length > 0 && (
            <div className="bg-paper-2 rounded p-2 space-y-2">
              <div className="text-[10px] font-semibold text-gray-500">
                CAMPOS DO PEDIDO (edite se precisar corrigir só nesta venda)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {form.valoresShopee.map((c, i) => (
                  <div key={i}>
                    <label className="text-[10px] block mb-1">
                      {c.nome} ({c.tipo === "percentual" ? "%" : "R$"})
                    </label>
                    <input
                      inputMode="decimal"
                      className="w-full border border-line rounded px-2 py-1.5 text-sm"
                      value={c.valor}
                      onChange={(e) => editarCampoForm(i, { valor: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.produtoId && (
            <div className="text-xs space-y-1 border-t border-line pt-2">
              <div className="flex justify-between">
                <span>Custo material</span>
                <span>{reais(custoTotalPreview)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxas</span>
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
                <div className="grid grid-cols-2 gap-2">
                  {formEdicao.valoresShopee.map((c, i) => (
                    <input
                      key={i}
                      inputMode="decimal"
                      className="border border-line rounded px-2 py-1.5 text-sm"
                      value={c.valor}
                      onChange={(e) =>
                        setFormEdicao((f) => ({
                          ...f,
                          valoresShopee: f.valoresShopee.map((x, j) =>
                            j === i ? { ...x, valor: e.target.value } : x
                          ),
                        }))
                      }
                      placeholder={`${c.nome} (${c.tipo === "percentual" ? "%" : "R$"})`}
                    />
                  ))}
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
