"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Pedido } from "@/lib/types";
import { labelStatus, podeSolicitarDevolucao } from "@/lib/status-pedido";

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export default function DetalhePedidoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch(`/api/pedidos/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: Pedido | null) => {
        if (ativo) setPedido(dados);
      })
      .catch(() => {
        if (ativo) setPedido(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [params.id]);

  async function solicitarDevolucao() {
    setErro("");
    setEnviando(true);

    const r = await fetch(`/api/pedidos/${params.id}/devolucao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    }).catch(() => null);

    setEnviando(false);

    const dados = await r?.json().catch(() => null);
    if (!r?.ok) {
      setErro(dados?.error ?? "Não foi possível solicitar a devolução.");
      return;
    }

    // A rota devolve o pedido já atualizado, então a tela não recarrega nada.
    setPedido(dados);
    setMostrarForm(false);
    setMotivo("");
  }

  if (carregando) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-ink/50 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-ink/60 text-sm mb-6">Pedido não encontrado.</p>
        <button
          onClick={() => router.push("/conta/pedidos")}
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
        >
          Voltar aos pedidos
        </button>
      </div>
    );
  }

  const produtos = pedido.total - pedido.frete;

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <button
        onClick={() => router.push("/conta/pedidos")}
        className="text-sm text-ink/50 mb-4"
      >
        ← Voltar
      </button>

      <h1 className="font-display text-2xl mb-1">Pedido #{pedido.id.slice(0, 8)}</h1>
      <p className="text-ink/60 text-sm mb-6">
        Feito em {new Date(pedido.createdAt).toLocaleDateString("pt-BR")}
      </p>

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <p className="text-xs uppercase tracking-wide text-ink/40 mb-2">Status</p>
        <p className="text-sm font-medium">{labelStatus(pedido.status)}</p>
        {pedido.motivoDevolucao && (
          <p className="text-xs text-ink/50 mt-2">
            Motivo da devolução: {pedido.motivoDevolucao}
          </p>
        )}
      </div>

      {/* Itens */}
      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <p className="text-xs uppercase tracking-wide text-ink/40 mb-3">Itens</p>
        {pedido.itens.map((it) => (
          <div key={it.id} className="flex items-center gap-3 py-2">
            <span
              className="w-11 h-11 rounded-md flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: `${it.produto.cor}22` }}
            >
              {it.produto.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{it.produto.nome}</p>
              <p className="text-xs text-ink/50">
                {[
                  ...Object.entries(it.variacoes).map(([k, v]) => `${k}: ${v}`),
                  `Qtd ${it.quantidade}`,
                ].join(" · ")}
              </p>
              {it.personalizacao?.briefing && (
                <p className="text-xs text-pine-2 mt-0.5">✓ {it.personalizacao.briefing}</p>
              )}
            </div>
            <p className="text-sm font-mono">{reais(it.precoUnitario * it.quantidade)}</p>
          </div>
        ))}

        <div className="pt-3 mt-2 border-t border-line space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink/60">Produtos</span>
            <span className="font-mono">{reais(produtos)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink/60">Frete</span>
            {/* Sem a marca de grátis, um frete zerado no histórico pareceria
                erro de cálculo em vez de benefício aplicado. */}
            <span className="font-mono">
              {pedido.freteGratis ? (
                <span className="text-pine-2">Grátis</span>
              ) : (
                reais(pedido.frete)
              )}
            </span>
          </div>
          <div className="flex items-center justify-between font-medium">
            <span>Total</span>
            <span className="font-mono">{reais(pedido.total)}</span>
          </div>
        </div>
      </div>

      {/* Entrega */}
      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <p className="text-xs uppercase tracking-wide text-ink/40 mb-2">
          Endereço de entrega
        </p>
        <p className="text-sm text-ink/80">
          {pedido.enderecoResumo ?? "Endereço não informado neste pedido."}
        </p>
      </div>

      {/* Devolução */}
      {podeSolicitarDevolucao(pedido.status) && (
        <div className="bg-white border border-line rounded-lg p-5">
          {mostrarForm ? (
            <>
              <p className="text-sm font-medium mb-1">Solicitar devolução</p>
              <p className="text-xs text-ink/50 mb-3">
                Conte o que aconteceu. Nossa equipe responde com as instruções de postagem.
              </p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={4}
                placeholder="Ex: a arte veio diferente da aprovada."
                className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine resize-none"
              />
              {erro && <p className="text-xs text-berry mt-2">{erro}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={solicitarDevolucao}
                  disabled={enviando || !motivo.trim()}
                  className="flex-1 bg-berry text-paper py-3 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {enviando ? "Enviando..." : "Enviar solicitação"}
                </button>
                <button
                  onClick={() => setMostrarForm(false)}
                  className="px-5 text-sm text-ink/50"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium mb-1">Algum problema com o pedido?</p>
              <p className="text-xs text-ink/50 mb-3">
                Você pode pedir devolução depois que o pedido é entregue.
              </p>
              <button
                onClick={() => setMostrarForm(true)}
                className="w-full border border-line rounded-full py-3 text-sm"
              >
                Solicitar devolução
              </button>
            </>
          )}
        </div>
      )}

      {pedido.status === "DEVOLUCAO_SOLICITADA" && (
        <p className="text-xs text-ink/50 text-center">
          Devolução em análise — avisamos por notificação assim que houver novidade.
        </p>
      )}
    </div>
  );
}
