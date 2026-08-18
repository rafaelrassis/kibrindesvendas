"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import type { ProdutoAdmin } from "@/lib/types";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export default function AdminProdutosPage() {
  // undefined enquanto a lista não chegou — evita "nenhum produto" piscando
  // antes da resposta.
  const [produtos, setProdutos] = useState<ProdutoAdmin[] | undefined>(undefined);
  const [erro, setErro] = useState("");
  const carregando = produtos === undefined;

  useEffect(() => {
    let ativo = true;
    fetch("/api/admin/produtos")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: ProdutoAdmin[]) => {
        if (ativo) setProdutos(lista);
      })
      .catch(() => {
        if (ativo) setProdutos([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function remover(id: string) {
    setErro("");
    const r = await fetch(`/api/admin/produtos/${id}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) {
      setErro(data.error ?? "Não foi possível remover.");
      return;
    }
    setProdutos((prev) => (prev ?? []).filter((p) => p.id !== id));
  }

  // Troca na tela na hora e desfaz se a gravação falhar — o botão é um liga/
  // desliga, recarregar a lista inteira a cada clique seria barulho à toa.
  async function alternarShopee(produto: ProdutoAdmin) {
    setErro("");
    const valor = !produto.vendidoNaShopee;
    const aplicar = (v: boolean) =>
      setProdutos((prev) =>
        (prev ?? []).map((p) => (p.id === produto.id ? { ...p, vendidoNaShopee: v } : p))
      );

    aplicar(valor);
    const r = await fetch(`/api/admin/produtos/${produto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendidoNaShopee: valor }),
    });
    if (!r.ok) {
      aplicar(produto.vendidoNaShopee);
      const data = await r.json().catch(() => ({}));
      setErro(data.error ?? "Não foi possível salvar.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Produtos</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna — cadastro gravado direto no banco.
      </p>
      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}
      <AdminNav />

      <Link
        href="/admin/produtos/novo"
        className="inline-block bg-pine text-white px-5 py-2.5 rounded-full text-sm mb-6 hover:brightness-110 transition"
      >
        + Novo produto
      </Link>

      <div className="bg-white border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-paper-2 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Preço</th>
              <th className="px-4 py-3 font-medium">Custo</th>
              <th className="px-4 py-3 font-medium">Lucro</th>
              <th className="px-4 py-3 font-medium">Personalização</th>
              <th className="px-4 py-3 font-medium">Vendido na Shopee</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink/50">
                  Carregando...
                </td>
              </tr>
            )}
            {produtos?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink/50">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
            {produtos?.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3">{p.emoji} {p.nome}</td>
                <td className="px-4 py-3 text-ink/60">{p.categoriaLabel}</td>
                <td className="px-4 py-3 font-mono">R$ {p.preco.toFixed(2).replace(".", ",")}</td>
                <td className="px-4 py-3 font-mono text-ink/60">
                  {p.materiais.length > 0 ? reais(p.custoTotal) : (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono">
                  {p.materiais.length > 0 ? (
                    <span className={p.lucro < 0 ? "text-berry" : "text-pine-2"}>
                      {reais(p.lucro)}
                      {p.margemPercentual !== null && (
                        <span className="text-ink/40 text-xs"> ({p.margemPercentual}%)</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      p.requerPersonalizacao
                        ? "bg-mustard/20 text-pine-2"
                        : "bg-ink/5 text-ink/50"
                    }`}
                  >
                    {p.requerPersonalizacao ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => alternarShopee(p)}
                    aria-pressed={p.vendidoNaShopee}
                    className={`text-xs px-2 py-1 rounded-full ${
                      p.vendidoNaShopee
                        ? "bg-mustard/20 text-pine-2"
                        : "bg-ink/5 text-ink/50"
                    }`}
                  >
                    {p.vendidoNaShopee ? "Sim" : "Não"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <Link
                    href={`/admin/produtos/${p.id}/editar`}
                    className="text-pine hover:underline text-xs"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => remover(p.id)}
                    className="text-berry hover:underline text-xs"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
