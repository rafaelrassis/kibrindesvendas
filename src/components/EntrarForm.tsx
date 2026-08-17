"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function EntrarForm({ destino }: { destino: string }) {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const r = await login(email.trim(), senha);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível entrar.");
      return;
    }
    router.push(destino);
  }

  return (
    <>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block">
          <span className="block text-xs text-ink/50 mb-1.5">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </label>
        <label className="block">
          <span className="block text-xs text-ink/50 mb-1.5">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </label>

        {erro && <p className="text-xs text-berry">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-pine text-paper py-3.5 rounded-full text-sm disabled:opacity-50"
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-sm text-ink/60 mt-6 text-center">
        Não tem conta?{" "}
        <Link href="/cadastro" className="text-pine font-medium hover:underline">
          Criar conta
        </Link>
      </p>
    </>
  );
}
