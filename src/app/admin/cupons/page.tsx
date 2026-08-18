"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import type { Cupom } from "@/lib/types";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

function labelValor(c: Cupom) {
  return c.tipo === "PERCENTUAL" ? `${c.valor}%` : reais(c.valor);
}

function expirado(c: Cupom) {
  return c.validoAte ? new Date(c.validoAte).getTime() < Date.now() : false;
}

function esgotado(c: Cupom) {
  return c.usoMaximo !== null && c.usos >= c.usoMaximo;
}

export default function AdminCuponsPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/admin/cupons")
      .then((r) => r.json())
      .then((lista) => setCupons(Array.isArray(lista) ? lista : []))
      .finally(() => setCarregando(false));
  }, []);

  async function alternarAtivo(cupom: Cupom) {
    setErro("");
    const r = await fetch(`/api/admin/cupons/${cupom.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !cupom.ativo }),
    });
    if (!r.ok) {
      setErro("Não foi possível mudar o status do cupom.");
      return;
    }
    setCupons((prev) => prev.map((c) => (c.id === cupom.id ? { ...c, ativo: !c.ativo } : c)));
  }

  async function remover(id: string) {
    setErro("");
    const r = await fetch(`/api/admin/cupons/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErro("Não foi possível remover o cupom.");
      return;
    }
    setCupons((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Cupons</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna — códigos de desconto aplicados no checkout.
      </p>
      <AdminNav />

      <Link
        href="/admin/cupons/novo"
        className="inline-block bg-pine text-white px-5 py-2.5 rounded-full text-sm mb-6 hover:brightness-110 transition"
      >
        + Novo cupom
      </Link>

      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}

      {carregando && <p className="text-ink/50 text-sm">Carregando...</p>}

      {!carregando && cupons.length === 0 && (
        <p className="text-ink/50 text-sm">Nenhum cupom cadastrado.</p>
      )}

      <div className="space-y-3">
        {cupons.map((c) => {
          const inativoDeFato = !c.ativo || expirado(c) || esgotado(c);
          return (
            <div
              key={c.id}
              className={`flex items-center gap-4 bg-white border border-line rounded-lg p-4 ${
                inativoDeFato ? "opacity-60" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono">{c.codigo}</p>
                <p className="text-xs text-ink/50 mt-0.5">
                  {labelValor(c)} de desconto
                  {c.valorMinimoPedido > 0 && ` · pedido mín. ${reais(c.valorMinimoPedido)}`}
                  {c.validoAte &&
                    ` · válido até ${new Date(c.validoAte).toLocaleDateString("pt-BR")}`}
                </p>
                <p className="text-xs text-ink/40 mt-0.5">
                  {c.usos} uso{c.usos === 1 ? "" : "s"}
                  {c.usoMaximo !== null && ` de ${c.usoMaximo}`}
                  {expirado(c) && " · expirado"}
                  {esgotado(c) && " · limite atingido"}
                </p>
              </div>

              <button
                onClick={() => alternarAtivo(c)}
                className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                  c.ativo ? "bg-mustard/20 text-pine-2" : "bg-ink/5 text-ink/50"
                }`}
              >
                {c.ativo ? "Ativo" : "Inativo"}
              </button>

              <Link
                href={`/admin/cupons/${c.id}/editar`}
                className="text-pine text-xs hover:underline shrink-0"
              >
                Editar
              </Link>
              <button
                onClick={() => remover(c.id)}
                className="text-berry text-xs hover:underline shrink-0"
              >
                Remover
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
