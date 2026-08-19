"use client";

import Link from "next/link";
import { useState } from "react";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const r = await fetch("/api/auth/recuperar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setEnviando(false);
    if (!r.ok) {
      const corpo = await r.json().catch(() => ({}));
      setErro(corpo.error ?? "Não foi possível enviar o link.");
      return;
    }
    setEnviado(true);
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-3xl mb-1">Esqueci minha senha</h1>
      <p className="text-ink/60 text-sm mb-8">
        Digite seu e-mail e mandamos um link pra você criar uma nova senha.
      </p>

      {enviado ? (
        <p className="text-sm text-pine">
          Se este e-mail tiver uma conta, você recebe o link em instantes. Confira também a
          caixa de spam.
        </p>
      ) : (
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

          {erro && <p className="text-xs text-berry">{erro}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-pine text-paper py-3.5 rounded-full text-sm disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Enviar link"}
          </button>
        </form>
      )}

      <p className="text-sm text-ink/60 mt-6 text-center">
        <Link href="/entrar" className="text-pine font-medium hover:underline">
          Voltar pro login
        </Link>
      </p>
    </div>
  );
}
