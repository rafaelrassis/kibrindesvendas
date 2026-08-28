"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Banner } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Os slides vêm do banco (cadastrados em /admin/banners) — sem nenhum ativo, a
// home simplesmente não mostra o carrossel, em vez de exibir promoção fixa que
// a loja não controla.
export default function PromoBanner({ banners }: { banners: Banner[] }) {
  const [ativo, setAtivo] = useState(0);
  const trilhoRef = useRef<HTMLDivElement>(null);
  const interagindoRef = useRef(false);

  // Rola o carrossel até o slide `i` — usado pelas setas, pelos dots e pelo
  // auto-advance. Usa scrollTo com o offset calculado (em vez de
  // scrollIntoView) porque scrollIntoView considera a página inteira e podia
  // puxar um scroll vertical indesejado no mobile.
  function irPara(i: number) {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const alvo = trilho.children[i] as HTMLElement | undefined;
    if (!alvo) return;
    const alvoLeft =
      alvo.getBoundingClientRect().left - trilho.getBoundingClientRect().left + trilho.scrollLeft;
    trilho.scrollTo({ left: alvoLeft, behavior: "smooth" });
    setAtivo(i);
  }

  const temVarios = banners.length > 1;

  // Auto-advance a cada 5s, mobile e desktop. Pausa quando o usuário interage
  // com o dedo/mouse no trilho para não brigar com o gesto dele.
  useEffect(() => {
    if (!temVarios) return;
    const id = setInterval(() => {
      if (interagindoRef.current) return;
      setAtivo((atual) => {
        const proximo = (atual + 1) % banners.length;
        irPara(proximo);
        return proximo;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [temVarios, banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl px-5 relative">
      <div
        ref={trilhoRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        onPointerDown={() => {
          interagindoRef.current = true;
        }}
        onPointerUp={() => {
          interagindoRef.current = false;
        }}
        onPointerCancel={() => {
          interagindoRef.current = false;
        }}
        onPointerLeave={() => {
          interagindoRef.current = false;
        }}
      >
        {banners.map((s, i) => (
          <Link
            key={s.id}
            href={s.ctaHref}
            className="snap-start shrink-0 w-full rounded-xl overflow-hidden relative aspect-[5/2] bg-cover bg-center"
            style={{
              backgroundColor: s.corFundo,
              backgroundImage: s.imagemUrl ? `url(${s.imagemUrl})` : undefined,
            }}
            onClick={() => setAtivo(i)}
          />
        ))}
      </div>

      {temVarios && (
        <>
          <button
            type="button"
            onClick={() => irPara((ativo - 1 + banners.length) % banners.length)}
            aria-label="Slide anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-ink flex items-center justify-center shadow-md transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => irPara((ativo + 1) % banners.length)}
            aria-label="Próximo slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-ink flex items-center justify-center shadow-md transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      <div className="flex justify-center gap-1.5 mt-3">
        {banners.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 rounded-full transition-all ${
              i === ativo ? "w-5 bg-pine" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
