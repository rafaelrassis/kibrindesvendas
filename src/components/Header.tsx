"use client";

import Link from "next/link";
import { useState } from "react";
import { categorias } from "@/lib/mock-data";

export default function Header() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-pine text-paper border-b border-black/20">
      <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl leading-none">🎁</span>
          <span className="font-display text-xl tracking-tight">Ki Brindes</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm tracking-wide uppercase">
          <div className="relative group">
            <button className="py-2 hover:text-mustard transition-colors cursor-pointer">
              Categorias
            </button>
            <div className="absolute left-0 top-full hidden group-hover:block pt-1 min-w-[200px]">
              <div className="bg-paper text-ink rounded-md shadow-lg border border-line overflow-hidden">
                {categorias.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/categoria/${c.slug}`}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm normal-case hover:bg-paper-2 transition-colors"
                  >
                    <span>{c.emoji}</span>
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/suporte" className="py-2 hover:text-mustard transition-colors">
            Suporte / FAQ
          </Link>
          <Link href="/admin/produtos" className="py-2 text-paper/50 hover:text-mustard transition-colors normal-case">
            Admin
          </Link>
        </nav>

        <button
          className="md:hidden text-2xl"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label="Abrir menu"
        >
          {menuAberto ? "✕" : "☰"}
        </button>
      </div>

      {menuAberto && (
        <div className="md:hidden border-t border-black/20 bg-pine-2 px-5 py-4 space-y-3 text-sm uppercase tracking-wide">
          <p className="text-paper/60 text-xs">Categorias</p>
          {categorias.map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="flex items-center gap-2 py-1"
              onClick={() => setMenuAberto(false)}
            >
              <span>{c.emoji}</span> {c.label}
            </Link>
          ))}
          <Link href="/suporte" className="block pt-2" onClick={() => setMenuAberto(false)}>
            Suporte / FAQ
          </Link>
        </div>
      )}
    </header>
  );
}
