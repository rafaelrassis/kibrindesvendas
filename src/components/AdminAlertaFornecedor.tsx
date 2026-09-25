"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AlertasFornecedor } from "@/lib/data/sync-fornecedor";

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Alerta fixo no topo de todo o /admin quando a sincronização com o
// fornecedor falhou (vermelho), achou variação sem par (amarelo) ou viu o
// preço do fornecedor mudar. Busca de novo a cada troca de página — o
// layout do admin não re-renderiza na navegação.
export default function AdminAlertaFornecedor() {
  const pathname = usePathname();
  const [alertas, setAlertas] = useState<AlertasFornecedor | null>(null);

  const carregar = useCallback(() => {
    fetch("/api/admin/fornecedor/alertas")
      .then((r) => (r.ok ? r.json() : null))
      .then(setAlertas)
      .catch(() => {});
  }, []);

  useEffect(carregar, [carregar, pathname]);
  useEffect(() => {
    window.addEventListener("alertas-fornecedor", carregar);
    return () => window.removeEventListener("alertas-fornecedor", carregar);
  }, [carregar]);

  async function ciente(produtoId: string) {
    const r = await fetch("/api/admin/fornecedor/alertas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produtoId }),
    });
    if (r.ok) setAlertas(await r.json());
  }

  if (!alertas) return null;
  const { erros, avisos, precos } = alertas;
  if (erros.length + avisos.length + precos.length === 0) return null;

  return (
    <div className="mx-auto max-w-4xl px-5 pt-6 space-y-3">
      {erros.length > 0 && (
        <div role="alert" className="rounded-lg border-2 border-berry bg-berry text-white p-4">
          <p className="font-semibold mb-2">
            ⚠️ Sincronização com fornecedor falhou em {erros.length} produto(s) — o estoque
            deles NÃO foi atualizado
          </p>
          <ul className="space-y-2 text-sm">
            {erros.map((e) => (
              <li key={e.produtoId} className="bg-white/10 rounded px-3 py-2">
                <Link href={`/admin/produtos/${e.produtoId}/editar`} className="font-semibold underline">
                  {e.nome}
                </Link>
                <span className="block">{e.erro}</span>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs underline break-all opacity-90"
                >
                  {e.url}
                </a>
                {e.em && (
                  <span className="block text-xs opacity-80">
                    {new Date(e.em).toLocaleString("pt-BR")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {precos.length > 0 && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 text-amber-900 p-4 text-sm">
          <p className="font-semibold mb-2">Preço do fornecedor mudou — confira sua margem</p>
          <ul className="space-y-1">
            {precos.map((p) => (
              <li key={p.produtoId} className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/produtos/${p.produtoId}/editar`} className="underline">
                  {p.nome}
                </Link>
                <span>
                  {moeda(p.de)} → <strong>{moeda(p.para)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => ciente(p.produtoId)}
                  className="text-xs border border-amber-400 rounded px-2 py-0.5"
                >
                  Ciente
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 text-amber-900 p-4 text-sm">
          <p className="font-semibold mb-2">Variações sem correspondente no fornecedor</p>
          <ul className="space-y-1">
            {avisos.map((a) => (
              <li key={a.produtoId}>
                <Link href={`/admin/produtos/${a.produtoId}/editar`} className="underline">
                  {a.nome}
                </Link>
                : {a.aviso}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
