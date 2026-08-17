"use client";

import {
  User,
  MapPin,
  Package,
  ShieldCheck,
  Bell,
  Heart,
  HelpCircle,
  LogOut,
  LogIn,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useConta } from "@/lib/conta-context";
import { pedidosMock } from "@/lib/conta-data";
import ContaMenuItem from "@/components/ContaMenuItem";

export default function ContaPage() {
  const { logado, carregando, usuario, sair } = useAuth();
  const { enderecos } = useConta();

  if (carregando) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-ink/60 text-sm">Carregando sua conta...</p>
      </div>
    );
  }

  if (!logado || !usuario) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-4xl mb-4">👤</p>
        <h1 className="font-display text-2xl mb-2">Entre na sua conta</h1>
        <p className="text-ink/60 text-sm mb-6">
          Faça login pra ver seus pedidos, endereços e dados salvos.
        </p>
        <Link
          href="/entrar"
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm inline-flex items-center gap-2"
        >
          <LogIn size={16} />
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      {/* Cabeçalho do perfil */}
      <div className="tag-shape tag-hole bg-pine text-paper px-5 py-5 mb-6 flex items-center gap-4">
        <span className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center text-2xl shrink-0">
          🙂
        </span>
        <div className="min-w-0">
          {/* Nome e e-mail vêm da conta real; o resto do perfil segue local. */}
          <p className="font-display text-xl truncate">{usuario.nome}</p>
          <p className="text-xs text-paper/70 truncate">{usuario.email}</p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <ContaMenuItem href="/conta/dados" icon={User} label="Meus dados" />
        <ContaMenuItem
          href="/conta/enderecos"
          icon={MapPin}
          label="Endereços"
          sublabel={
            enderecos.length
              ? `${enderecos.length} salvo${enderecos.length > 1 ? "s" : ""}`
              : "Nenhum endereço salvo"
          }
        />
        <ContaMenuItem
          href="/conta/pedidos"
          icon={Package}
          label="Meus pedidos"
          sublabel={`${pedidosMock.length} pedido${pedidosMock.length > 1 ? "s" : ""}`}
        />
        <ContaMenuItem href="/favoritos" icon={Heart} label="Favoritos" />
      </div>

      <p className="text-xs uppercase tracking-wide text-ink/40 mb-2 px-1">
        Preferências e segurança
      </p>
      <div className="space-y-2 mb-6">
        <ContaMenuItem
          href="/conta/preferencias"
          icon={Bell}
          label="Notificações"
        />
        <ContaMenuItem href="/conta/seguranca" icon={ShieldCheck} label="Senha e segurança" />
        <ContaMenuItem href="/suporte" icon={HelpCircle} label="Ajuda e suporte" />
      </div>

      <button
        onClick={sair}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white border border-line rounded-lg text-berry text-sm"
      >
        <LogOut size={16} />
        Sair da conta
      </button>
    </div>
  );
}
