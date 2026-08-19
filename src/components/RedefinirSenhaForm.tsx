"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RedefinirSenhaForm({ token }: { token: string | undefined }) {
  const router = useRouter();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!token) {
    return (
      <p className="text-sm text-berry">
        Link inválido. Peça um novo em{" "}
        <Link href="/esqueci-senha" className="text-pine hover:underline">
          esqueci minha senha
        </Link>
        .
      </p>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (novaSenha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }
    setEnviando(true);
    const r = await fetch("/api/auth/recuperar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, novaSenha }),
    });
    setEnviando(false);
    if (!r.ok) {
      const corpo = await r.json().catch(() => ({}));
      setErro(corpo.error ?? "Não foi possível redefinir a senha.");
      return;
    }
    router.push("/entrar");
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <label className="block">
        <span className="block text-xs text-ink/50 mb-1.5">Nova senha</span>
        <input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine"
          required
        />
      </label>
      <label className="block">
        <span className="block text-xs text-ink/50 mb-1.5">Confirmar nova senha</span>
        <input
          type="password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
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
        {enviando ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
