"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

// Visitante (sem conta) guarda o carrinho por e-mail e recebe um lembrete com o
// link pra voltar. Quem está logado já tem o carrinho salvo na conta.
export default function SalvarCarrinhoPorEmail() {
  const { itens } = useCart();
  const { logado, carregando } = useAuth();
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);

  if (carregando || logado || itens.length === 0) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await fetch("/api/carrinho/visitante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          telefone,
          consentimento: aceito,
          itens: itens.map((i) => ({
            produtoId: i.produtoId,
            variacoesEscolhidas: i.variacoesEscolhidas,
            quantidade: i.quantidade,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.error ?? "Não foi possível guardar o carrinho.");
        return;
      }
      setSalvo(true);
    } catch {
      setErro("Não foi possível guardar o carrinho agora.");
    } finally {
      setEnviando(false);
    }
  }

  if (salvo) {
    return (
      <p className="bg-pine/5 border border-pine/30 rounded-lg px-5 py-4 text-sm text-pine-2 mb-8">
        ✓ Carrinho guardado. Se você esquecer, mandamos um lembrete com o link pra voltar.
      </p>
    );
  }

  return (
    <form onSubmit={salvar} className="bg-white border border-line rounded-lg p-5 mb-8">
      <p className="text-sm font-medium mb-1">Guardar meu carrinho</p>
      <p className="text-xs text-ink/50 mb-3">
        Sem criar conta: deixe seu e-mail e a gente avisa se você esquecer.
      </p>
      <div className="flex gap-2 mb-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          aria-label="Seu e-mail"
          className="flex-1 bg-white border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-pine"
        />
        <button
          type="submit"
          disabled={enviando || !aceito || !email.trim()}
          className="bg-pine/10 text-pine-2 font-medium px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 hover:bg-pine/15 transition"
        >
          {enviando ? "..." : "Guardar"}
        </button>
      </div>
      <input
        type="tel"
        inputMode="tel"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        placeholder="WhatsApp com DDD (opcional)"
        aria-label="WhatsApp (opcional)"
        className="w-full bg-white border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-pine mb-3"
      />
      <label className="flex items-start gap-2 text-xs text-ink/60">
        <input
          type="checkbox"
          checked={aceito}
          onChange={(e) => setAceito(e.target.checked)}
          className="mt-0.5"
        />
        Aceito receber um lembrete sobre este carrinho por e-mail e, se informei o WhatsApp,
        por mensagem. Posso apagar meus dados pelo link do e-mail.
      </label>
      {erro && <p className="text-xs text-berry mt-2">{erro}</p>}
    </form>
  );
}
