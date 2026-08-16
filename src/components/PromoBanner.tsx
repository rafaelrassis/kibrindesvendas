"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Slide = {
  bg: string;
  eyebrow: string;
  titulo: string;
  preco: string;
  ctaHref: string;
};

const slides: Slide[] = [
  { bg: "#9C1C95", eyebrow: "Tudo pra presentear", titulo: "Ímãs personalizados", preco: "A partir de R$ 24,90", ctaHref: "/categoria/imas" },
  { bg: "#D9A63E", eyebrow: "Novidade", titulo: "Canecas com sua foto", preco: "A partir de R$ 29,90", ctaHref: "/categoria/canecas" },
  { bg: "#7A1674", eyebrow: "Fim de semana", titulo: "Moletons personalizados", preco: "A partir de R$ 89,90", ctaHref: "/categoria/moletons" },
];

export default function PromoBanner() {
  const [ativo, setAtivo] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setAtivo((v) => (v + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-5">
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        {slides.map((s, i) => (
          <Link
            key={i}
            href={s.ctaHref}
            className="snap-start shrink-0 w-[88%] sm:w-full rounded-xl overflow-hidden relative h-40 md:h-52 flex items-center"
            style={{ backgroundColor: s.bg }}
            onClick={() => setAtivo(i)}
          >
            <div className="px-6 text-white">
              <p className="uppercase text-[11px] tracking-widest text-white/70 mb-1">
                {s.eyebrow}
              </p>
              <p className="font-display text-2xl md:text-3xl leading-tight mb-2">{s.titulo}</p>
              <p className="bg-white text-ink inline-block text-sm font-medium px-3 py-1 rounded-full">
                {s.preco}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-3">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === ativo ? "w-5 bg-pine" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
