"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart, type NovoItemCarrinho } from "@/lib/cart-context";

// Destino do link do e-mail de carrinho de visitante: devolve os itens ao
// navegador e segue pro carrinho. Com ?cancelar=1 pede confirmação e apaga.
export default function RecuperarCarrinhoPage() {
  const { token } = useParams<{ token: string }>();
  const cancelar = useSearchParams().get("cancelar") === "1";
  const router = useRouter();
  const { restaurarItens } = useCart();
  const [estado, setEstado] = useState<"carregando" | "invalido" | "apagado" | "confirmar">(
    cancelar ? "confirmar" : "carregando"
  );
  // O efeito roda duas vezes em dev (StrictMode); restaurar duas vezes dobraria
  // as quantidades.
  const iniciou = useRef(false);

  useEffect(() => {
    if (cancelar || iniciou.current) return;
    iniciou.current = true;
    fetch(`/api/carrinho/visitante/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as NovoItemCarrinho[];
      })
      .then((linhas) => {
        restaurarItens(linhas);
        router.replace("/carrinho");
      })
      .catch(() => setEstado("invalido"));
  }, [token, cancelar, restaurarItens, router]);

  async function apagar() {
    await fetch(`/api/carrinho/visitante/${token}`, { method: "DELETE" }).catch(() => {});
    setEstado("apagado");
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      {estado === "carregando" && <p className="text-ink/60">Recuperando seu carrinho...</p>}
      {estado === "invalido" && (
        <>
          <p className="text-ink/70 mb-4">Este link não é mais válido.</p>
          <button
            onClick={() => router.push("/")}
            className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
          >
            Ver produtos
          </button>
        </>
      )}
      {estado === "confirmar" && (
        <>
          <h1 className="font-display text-2xl mb-3">Apagar meu carrinho?</h1>
          <p className="text-ink/60 text-sm mb-6">
            Vamos apagar o carrinho guardado e seu e-mail, e você não recebe mais lembretes.
          </p>
          <button onClick={apagar} className="bg-berry text-paper px-6 py-2.5 rounded-full text-sm">
            Apagar e parar de receber
          </button>
        </>
      )}
      {estado === "apagado" && <p className="text-ink/70">Pronto — seu carrinho e e-mail foram apagados.</p>}
    </div>
  );
}
