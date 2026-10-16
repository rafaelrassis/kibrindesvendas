"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useProdutos } from "@/lib/use-produtos";
import { precoEfetivo } from "@/lib/estoque-variacao";
import { faltaParaFreteGratis } from "@/lib/carrinho-avisos";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

// Mini-carrinho lateral, só no desktop (md+): abre ao adicionar um item ou ao
// clicar no 🛒 do header. No mobile o 🛒 leva direto pra /carrinho.
export default function MiniCarrinho({ freteGratisAcimaDe }: { freteGratisAcimaDe: number | null }) {
  const { itens, drawerAberto, fecharDrawer, removerItem } = useCart();
  const pathname = usePathname();
  const { produtos } = useProdutos(drawerAberto ? itens.map((i) => i.produtoId) : []);

  // Esc fecha; navegar pra outra página também (o drawer não deve sobreviver).
  useEffect(() => {
    if (!drawerAberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fecharDrawer();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [drawerAberto, fecharDrawer]);
  useEffect(() => {
    fecharDrawer();
  }, [pathname, fecharDrawer]);

  if (!drawerAberto) return null;

  const subtotal = itens.reduce((soma, i) => {
    const p = produtos[i.produtoId];
    return p ? soma + precoEfetivo(p, i.variacoesEscolhidas) * i.quantidade : soma;
  }, 0);
  const falta = faltaParaFreteGratis(subtotal, freteGratisAcimaDe);

  return (
    <div className="hidden md:block fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Carrinho">
      <button
        aria-label="Fechar carrinho"
        onClick={fecharDrawer}
        className="absolute inset-0 bg-black/40 cursor-default"
      />
      <aside className="absolute right-0 top-0 h-full w-[380px] bg-paper shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-xl">Carrinho</h2>
          <button onClick={fecharDrawer} aria-label="Fechar" className="text-2xl leading-none text-ink/50">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {itens.length === 0 && <p className="text-sm text-ink/60">Seu carrinho está vazio.</p>}
          {itens.map((item) => {
            const p = produtos[item.produtoId];
            if (!p) return null;
            return (
              <div key={item.id} className="flex gap-3 bg-white border border-line rounded-lg p-3">
                <div
                  className="w-12 h-12 rounded-md flex items-center justify-center text-xl shrink-0 overflow-hidden"
                  style={{ backgroundColor: `${p.cor}22` }}
                >
                  {p.imagens[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagens[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    p.emoji
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.nome}</p>
                  <p className="text-xs text-ink/50 truncate">
                    {Object.values(item.variacoesEscolhidas).join(" · ")}
                  </p>
                  <p className="text-xs text-ink/60 mt-0.5">
                    {item.quantidade}x{" "}
                    <span className="font-mono">
                      {reais(precoEfetivo(p, item.variacoesEscolhidas))}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => removerItem(item.id)}
                  className="text-xs text-berry hover:underline self-start"
                  aria-label={`Remover ${p.nome}`}
                >
                  Remover
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line px-5 py-4 space-y-3">
          {freteGratisAcimaDe !== null && itens.length > 0 && (
            <p className="text-xs text-pine-2">
              {falta === null
                ? "🎉 Frete grátis garantido!"
                : `Faltam ${reais(falta)} pra ganhar frete grátis.`}
            </p>
          )}
          <div className="flex justify-between font-medium">
            <span>Subtotal</span>
            <span className="font-mono">{reais(subtotal)}</span>
          </div>
          <Link
            href="/carrinho"
            className="block text-center bg-pine text-white font-medium px-6 py-3 rounded-full hover:brightness-110 transition"
          >
            Ver carrinho
          </Link>
          <button onClick={fecharDrawer} className="w-full text-center text-sm text-pine-2 hover:underline">
            Continuar comprando
          </button>
        </div>
      </aside>
    </div>
  );
}
