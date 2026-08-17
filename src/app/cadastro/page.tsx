"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function CadastroPage() {
  const router = useRouter();
  const { registrar } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const r = await registrar(nome.trim(), email.trim(), senha);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível criar a conta.");
      return;
    }
    router.push("/conta");
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-3xl mb-1">Criar conta</h1>
      <p className="text-ink/60 text-sm mb-8">Leva menos de um minuto.</p>

      <form onSubmit={enviar} className="space-y-4">
        <label className="block">
          <span className="block text-xs text-ink/50 mb-1.5">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
        </label>
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
            minLength={6}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
            required
          />
          <span className="block text-[11px] text-ink/40 mt-1">Mínimo de 6 caracteres.</span>
        </label>

        {erro && <p className="text-xs text-berry">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-pine text-paper py-3.5 rounded-full text-sm disabled:opacity-50"
        >
          {enviando ? "Criando..." : "Criar conta"}
        </button>
      </form>

      <p className="text-sm text-ink/60 mt-6 text-center">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-pine font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
