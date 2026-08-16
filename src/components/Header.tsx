"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { categorias } from "@/lib/mock-data";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

export default function Header() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const router = useRouter();
  const { item } = useCart();
  const { logado, entrar, sair } = useAuth();

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/busca?q=${encodeURIComponent(termo)}`);
    setBuscaAberta(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-pine text-white border-b border-black/10">
      <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl leading-none">🎁</span>
          <span className="font-display text-xl tracking-tight">LeoKibrindes</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm tracking-wide uppercase">
          <div className="relative group">
            <button className="py-2 hover:text-mustard transition-colors cursor-pointer">
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
          <Link href="/suporte" className="py-2 hover:text-mustard transition-colors">
            Suporte / FAQ
          </Link>
          <Link href="/admin/produtos" className="py-2 text-white/50 hover:text-mustard transition-colors normal-case">
            Admin
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {/* Busca */}
          <div className="relative">
            {buscaAberta ? (
              <form onSubmit={buscar} className="flex items-center">
                <input
                  autoFocus
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  onBlur={() => !termo && setBuscaAberta(false)}
                  placeholder="Buscar produtos..."
                  className="bg-white text-ink text-sm rounded-full pl-4 pr-9 py-1.5 w-40 sm:w-56 outline-none"
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="absolute right-2 text-ink/50 hover:text-ink"
                >
                  🔍
                </button>
              </form>
            ) : (
              <button
                aria-label="Abrir busca"
                onClick={() => setBuscaAberta(true)}
                className="text-xl hover:text-mustard transition-colors"
              >
                🔍
              </button>
            )}
          </div>

          {/* Sacola */}
          <Link href="/checkout" aria-label="Sacola" className="relative text-xl hover:text-mustard transition-colors">
            👜
            {item && (
              <span className="absolute -top-1.5 -right-1.5 bg-mustard text-pine text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                1
              </span>
            )}
          </Link>

          {/* Entrar / Usuário */}
          {logado ? (
            <button
              onClick={sair}
              aria-label="Minha conta"
              title="Sair"
              className="text-xl hover:text-mustard transition-colors"
            >
              👤
            </button>
          ) : (
            <button
              onClick={entrar}
              className="flex items-center gap-1.5 text-sm hover:text-mustard transition-colors"
            >
              <span className="text-lg leading-none">🔑</span>
              <span className="hidden sm:inline">Entrar</span>
            </button>
          )}

          <button
            className="md:hidden text-2xl"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Abrir menu"
          >
            {menuAberto ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {menuAberto && (
        <div className="md:hidden border-t border-black/10 bg-pine-2 px-5 py-4 space-y-3 text-sm uppercase tracking-wide">
          <p className="text-white/60 text-xs">Categorias</p>
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
