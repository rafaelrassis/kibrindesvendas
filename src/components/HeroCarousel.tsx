"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Slide = {
  etiquetaTop: string;
  titulo: React.ReactNode;
  texto: string;
  ctaLabel: string;
  ctaHref: string;
  tagPara: string;
  tagMsg: string;
};

const slides: Slide[] = [
  {
    etiquetaTop: "Feito sob medida pra quem recebe",
    titulo: (
      <>
        Cada presente começa com uma história.
        <br />
        A gente coloca ela no produto.
      </>
    ),
    texto:
      "Ímãs, canecas, camisetas e moletons personalizados com a sua foto, sua arte ou uma ideia — e produtos prontos, sem enrolação.",
    ctaLabel: "Ver ímãs personalizados",
    ctaHref: "/categoria/imas",
    tagPara: "Vó Marlene",
    tagMsg: "Com carinho, da sua neta favorita 💛",
  },
  {
    etiquetaTop: "Novidade",
    titulo: (
      <>
        Canecas que contam
        <br />
        a sua história todo dia.
      </>
    ),
    texto: "Escolha a foto, a frase ou o desenho — a gente personaliza e envia.",
    ctaLabel: "Ver canecas",
    ctaHref: "/categoria/canecas",
    tagPara: "Seu Zé",
    tagMsg: "Café não é a mesma coisa sem essa caneca ☕",
  },
  {
    etiquetaTop: "Preço justo",
    titulo: (
      <>
        Mais barato que na Shopee,
        <br />
        direto com a gente.
      </>
    ),
    texto: "Mesma qualidade, sem taxa de plataforma. Compare e confira.",
    ctaLabel: "Ver moletons",
    ctaHref: "/categoria/moletons",
    tagPara: "Dupla de amigos",
    tagMsg: "Um presente que esquenta o coração 🧥",
  },
];

export default function HeroCarousel() {
  const [ativo, setAtivo] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setAtivo((v) => (v + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, []);

  const slide = slides[ativo];

  return (
    <section className="bg-pine text-white">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
        <div>
          <p className="uppercase tracking-[0.2em] text-xs text-mustard mb-4">
            {slide.etiquetaTop}
          </p>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.05] mb-5">
            {slide.titulo}
          </h1>
          <p className="text-white/70 max-w-md mb-8">{slide.texto}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={slide.ctaHref}
              className="bg-mustard text-pine font-medium px-6 py-3 rounded-full hover:brightness-95 transition"
            >
              {slide.ctaLabel}
            </Link>
            <Link
              href="/suporte"
              className="border border-white/30 px-6 py-3 rounded-full hover:bg-white/10 transition"
            >
              Como funciona
            </Link>
          </div>

          <div className="flex gap-2 mt-8">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Ir para slide ${i + 1}`}
                onClick={() => setAtivo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === ativo ? "w-6 bg-mustard" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="tag-shape tag-hole bg-white text-ink p-6 rotate-2 shadow-xl w-full max-w-xs mx-auto transition-all">
          <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Etiqueta de presente</p>
          <p className="font-display text-2xl mb-1">Pra: {slide.tagPara}</p>
          <p className="text-sm text-ink/60">{slide.tagMsg}</p>
        </div>
      </div>
    </section>
  );
}
