"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

export default function BottomNav() {
  const pathname = usePathname();
  const { item } = useCart();
  const { logado } = useAuth();

  const itens = [
    { href: "/", label: "Início", icon: "🏠" },
    { href: "/categorias", label: "Categorias", icon: "📂" },
    { href: "/favoritos", label: "Favoritos", icon: "🤍" },
    { href: "/checkout", label: "Sacola", icon: "👜", badge: !!item },
    { href: logado ? "/admin/produtos" : "/", label: "Conta", icon: "👤" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line">
      <div className="grid grid-cols-5">
        {itens.map((it) => {
          const ativo = pathname === it.href;
          return (
            <Link
              key={it.label}
              href={it.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] ${
                ativo ? "text-pine" : "text-ink/50"
              }`}
            >
              <span className="text-lg leading-none">{it.icon}</span>
              {it.badge && (
                <span className="absolute top-1 right-[calc(50%-16px)] bg-berry text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  1
                </span>
              )}
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
