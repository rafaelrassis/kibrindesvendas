"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Banner } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Os slides vêm do banco (cadastrados em /admin/banners) — sem nenhum ativo, a
// home simplesmente não mostra o carrossel, em vez de exibir promoção fixa que
// a loja não controla.
export default function PromoBanner({ banners }: { banners: Banner[] }) {
  const [ativo, setAtivo] = useState(0);
  const trilhoRef = useRef<HTMLDivElement>(null);

  // Rola o carrossel até o slide `i` — usado pelas setas, pelos dots e pelo
  // auto-advance. scrollIntoView respeita o scroll-snap já configurado no
  // trilho, então não precisa calcular largura de slide na mão.
  function irPara(i: number) {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const alvo = trilho.children[i] as HTMLElement | undefined;
    alvo?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setAtivo(i);
  }

  // Auto-advance removido: causava scroll vertical indesejado na home no
  // mobile (scrollIntoView disparado sozinho a cada 5s). Navegação agora é
  // só manual — setas e dots.

  if (banners.length === 0) return null;

  const temVarios = banners.length > 1;

  return (
    <div className="mx-auto max-w-6xl px-5 relative">
      <div
        ref={trilhoRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {banners.map((s, i) => (
          <Link
            key={s.id}
            href={s.ctaHref}
            className="snap-start shrink-0 w-[88%] sm:w-full rounded-xl overflow-hidden relative h-40 md:h-52 bg-cover bg-center"
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
