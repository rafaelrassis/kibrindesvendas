"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Categoria } from "@/lib/types";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useNotificacoes } from "@/lib/notificacoes-context";
import { Search } from "lucide-react";

export default function Header({ categorias }: { categorias: Categoria[] }) {
  const [termo, setTermo] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const home = pathname === "/";
  const { item } = useCart();
  const { logado } = useAuth();
  const { naoLidas } = useNotificacoes();

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/busca?q=${encodeURIComponent(termo)}`);
  };

  return (
    <header className="sticky top-0 z-30 bg-pine text-white border-b border-black/10">
      {/* Logo — no mobile aparece só na home; no desktop sempre, junto da nav.
          h-[92px]: ocupa do topo até o fim da barra inicial, como pedido. */}
      {home && (
        <div className="md:hidden mx-auto max-w-6xl px-5 flex items-center justify-center h-[92px]">
          <Link href="/" className="inline-flex items-center h-full">
            <Image
              src="/logo.png"
              alt="LeoKibrindes"
              width={220}
              height={92}
              priority
              className="h-[76%] w-auto"
            />
          </Link>
        </div>
      )}

      {/* Desktop: uma única linha — logo | categorias/links | busca | ícones.
          A busca fica ao lado dos links de navegação, não numa linha à parte
          embaixo — o menu de categorias não fica mais "escondido" abaixo da
          busca. */}
      <div className="hidden md:flex mx-auto max-w-6xl px-5 items-center gap-7 h-[92px]">
        <Link href="/" className="inline-flex items-center h-full shrink-0">
          <Image
            src="/logo.png"
            alt="LeoKibrindes"
            width={220}
            height={92}
            priority
            className="h-full w-auto"
          />
        </Link>

        <nav className="flex items-center gap-6 text-sm tracking-wide uppercase shrink-0">
          <div className="relative group">
            <Link href="/categorias" className="py-2 uppercase hover:text-mustard transition-colors block">
              Categorias
            </Link>
            <div className="absolute left-0 top-full hidden group-hover:block pt-1 min-w-[200px]">
              <div className="bg-white text-ink rounded-md shadow-lg border border-line overflow-hidden">
                {categorias.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/categoria/${c.slug}`}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm normal-case hover:bg-paper-2 transition-colors"
                  >
                    {c.imagemUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imagemUrl} alt="" className="w-5 h-5 rounded object-cover" />
                    ) : (
                      <span>🎁</span>
                    )}
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/favoritos" className="py-2 hover:text-mustard transition-colors">
            Favoritos
          </Link>
          <Link href="/suporte" className="py-2 hover:text-mustard transition-colors">
            Suporte / FAQ
          </Link>
        </nav>

        <form onSubmit={buscar} className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40"
            aria-hidden="true"
          />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Busca na LeoKibrindes"
            aria-label="Buscar produtos"
            className="w-full bg-white text-ink rounded-full pl-11 pr-5 py-2.5 text-sm outline-none shadow-sm"
          />
        </form>

        <div className="flex items-center gap-4 shrink-0 ml-auto">
          <Link
            href="/notificacoes"
            aria-label="Notificações"
            className="relative text-xl hover:text-mustard transition-colors"
          >
            🔔
            {naoLidas > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-mustard text-pine text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {naoLidas > 9 ? "9+" : naoLidas}
              </span>
            )}
          </Link>

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
            <Link
              href="/entrar"
              className="flex items-center gap-1.5 text-sm hover:text-mustard transition-colors"
            >
              <span className="text-lg leading-none">🔑</span>
              Entrar
            </Link>
          )}
        </div>
      </div>

      {/* Busca — mobile, linha própria (no desktop já entrou na linha acima) */}
      <form onSubmit={buscar} className="md:hidden mx-auto max-w-6xl px-5 pt-4 pb-4 flex items-center gap-3">
        {!home && (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Voltar"
            className="shrink-0 text-2xl leading-none hover:text-mustard transition-colors"
          >
            ←
          </button>
        )}
        <div className="relative flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40"
            aria-hidden="true"
          />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Busca na LeoKibrindes"
            aria-label="Buscar produtos"
            className="w-full bg-white text-ink rounded-full pl-11 pr-5 py-3 text-sm outline-none shadow-sm"
          />
        </div>
        <Link
          href="/notificacoes"
          aria-label="Notificações"
          className="relative shrink-0 text-2xl leading-none hover:text-mustard transition-colors"
        >
          🔔
          {naoLidas > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-mustard text-pine text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Link>
      </form>
    </header>
  );
}
