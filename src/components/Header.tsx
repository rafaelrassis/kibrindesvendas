"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { categorias } from "@/lib/mock-data";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

export default function Header() {
  const [termo, setTermo] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const home = pathname === "/";
  const { item } = useCart();
  const { logado, entrar } = useAuth();

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/busca?q=${encodeURIComponent(termo)}`);
  };

  return (
    <header className="sticky top-0 z-30 bg-pine text-white border-b border-black/10">
      {/* Logo — no mobile aparece só na home; no desktop sempre, junto da nav */}
      {home && (
        <div className="md:hidden mx-auto max-w-6xl px-5 pt-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl leading-none">🎁</span>
            <span className="font-display text-xl tracking-tight">LeoKibrindes</span>
          </Link>
        </div>
      )}

      {/* Linha de navegação — só no desktop, onde a BottomNav não existe */}
      <div className="hidden md:flex mx-auto max-w-6xl px-5 pt-4 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl leading-none">🎁</span>
          <span className="font-display text-xl tracking-tight">LeoKibrindes</span>
        </Link>

        <nav className="flex items-center gap-6 text-sm tracking-wide uppercase">
          <div className="relative group">
            <button className="py-2 uppercase hover:text-mustard transition-colors cursor-pointer">
              Categorias
            </button>
            <div className="absolute left-0 top-full hidden group-hover:block pt-1 min-w-[200px]">
              <div className="bg-white text-ink rounded-md shadow-lg border border-line overflow-hidden">
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
          <Link href="/comparativo" className="py-2 hover:text-mustard transition-colors">
            Comparar preços
          </Link>
          <Link href="/favoritos" className="py-2 hover:text-mustard transition-colors">
            Favoritos
          </Link>
          <Link href="/suporte" className="py-2 hover:text-mustard transition-colors">
            Suporte / FAQ
          </Link>
          <Link
            href="/admin/produtos"
            className="py-2 text-white/50 hover:text-mustard transition-colors normal-case"
          >
            Admin
          </Link>
        </nav>

        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/checkout"
            aria-label="Sacola"
            className="relative text-xl hover:text-mustard transition-colors"
          >
            👜
            {item && (
              <span className="absolute -top-1.5 -right-1.5 bg-mustard text-pine text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                1
              </span>
            )}
          </Link>

          {logado ? (
            <Link
              href="/conta"
              aria-label="Minha conta"
              className="text-xl hover:text-mustard transition-colors"
            >
              👤
            </Link>
          ) : (
            <button
              onClick={entrar}
              className="flex items-center gap-1.5 text-sm hover:text-mustard transition-colors"
            >
              <span className="text-lg leading-none">🔑</span>
              Entrar
            </button>
          )}
        </div>
      </div>

      {/* Busca — sempre visível, linha própria em todos os tamanhos */}
      <form onSubmit={buscar} className="mx-auto max-w-6xl px-5 pt-4 pb-4 flex items-center gap-3">
        {!home && (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Voltar"
            className="md:hidden shrink-0 text-2xl leading-none hover:text-mustard transition-colors"
          >
            ←
          </button>
        )}
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Busca na LeoKibrindes"
          className="flex-1 bg-white text-ink rounded-full px-5 py-3 text-sm outline-none shadow-sm"
        />
        <Link
          href="/notificacoes"
          aria-label="Notificações"
          className="md:hidden relative shrink-0 text-2xl leading-none hover:text-mustard transition-colors"
        >
          🔔
          <span className="absolute -top-1.5 -right-1.5 bg-mustard text-pine text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            3
          </span>
        </Link>
      </form>
    </header>
  );
}
