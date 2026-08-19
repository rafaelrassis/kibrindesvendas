"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

type Avaliacao = {
  id: string;
  nota: number;
  comentario: string | null;
  autor: string;
  createdAt: string;
};

type Resposta = {
  avaliacoes: Avaliacao[];
  resumo: { media: number; total: number };
  minhaAvaliacaoPendente: boolean;
  jaAvaliei: boolean;
};

function Estrelas({ nota, tamanho = "text-base" }: { nota: number; tamanho?: string }) {
  return (
    <span className={`${tamanho} text-mustard leading-none`} aria-label={`${nota} de 5 estrelas`}>
      {"★".repeat(nota)}
      <span className="text-ink/20">{"★".repeat(5 - nota)}</span>
    </span>
  );
}

export default function AvaliacoesProduto({ produtoId }: { produtoId: string }) {
  const { usuario } = useAuth();
  const [resposta, setResposta] = useState<{ id: string; dados: Resposta | null }>();
  const [notaEscolhida, setNotaEscolhida] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  // A resposta carrega o id que originou a busca: enquanto ela não corresponder
  // ao produto pedido, a seção fica fora da tela — mesmo padrão de useProduto,
  // que evita um estado separado só pra dizer "carregando".
  useEffect(() => {
    let ativo = true;
    fetch(`/api/produtos/${produtoId}/avaliacoes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: Resposta | null) => {
        if (ativo) setResposta({ id: produtoId, dados });
      })
      .catch(() => {
        if (ativo) setResposta({ id: produtoId, dados: null });
      });
    return () => {
      ativo = false;
    };
  }, [produtoId]);

  async function enviarAvaliacao(e: React.FormEvent) {
    e.preventDefault();
    if (!notaEscolhida) return;
    setErro("");
    setEnviando(true);
    const r = await fetch(`/api/produtos/${produtoId}/avaliacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nota: notaEscolhida, comentario }),
    });
    setEnviando(false);
    if (!r.ok) {
      const corpo = await r.json().catch(() => ({}));
      setErro(corpo.error ?? "Não foi possível enviar sua avaliação.");
      return;
    }
    setEnviado(true);
  }

  const dados = resposta?.id === produtoId ? resposta.dados : null;
  if (!dados) return null;

  const { avaliacoes, resumo } = dados;
  const jaAvaliei = dados.jaAvaliei || enviado;

  return (
    <div className="mt-10 pt-8 border-t border-line">
      <h2 className="font-display text-2xl mb-3">Avaliações</h2>

      {resumo.total > 0 ? (
        <div className="flex items-center gap-3 mb-6">
          <Estrelas nota={Math.round(resumo.media)} tamanho="text-xl" />
          <p className="text-sm text-ink/60">
            {resumo.media.toFixed(1)} de 5 · {resumo.total} avaliaç{resumo.total === 1 ? "ão" : "ões"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink/50 mb-6">Ainda sem avaliações. Seja o primeiro a avaliar.</p>
      )}

      {avaliacoes.length > 0 && (
        <div className="space-y-4 mb-8">
          {avaliacoes.map((a) => (
            <div key={a.id} className="border border-line rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <Estrelas nota={a.nota} />
                <span className="text-xs text-ink/40">
                  {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {a.comentario && <p className="text-sm text-ink/70 mt-1">{a.comentario}</p>}
              <p className="text-xs text-ink/40 mt-2">{a.autor}</p>
            </div>
          ))}
        </div>
      )}

      {!usuario && (
        <p className="text-sm text-ink/50">
          Entre na sua conta pra avaliar este produto (disponível pra quem já comprou).
        </p>
      )}

      {usuario && dados.minhaAvaliacaoPendente && !enviado && (
        <p className="text-sm text-ink/50">
          Sua avaliação foi enviada e está em análise. Obrigado pelo retorno!
        </p>
      )}

      {usuario && jaAvaliei && enviado && (
        <p className="text-sm text-pine">
          Avaliação enviada! Ela aparece aqui assim que aprovada pela equipe.
        </p>
      )}

      {usuario && !dados.jaAvaliei && !enviado && (
        <form onSubmit={enviarAvaliacao} className="border border-line rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Avaliar este produto</p>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNotaEscolhida(n)}
                className={`text-2xl leading-none ${n <= notaEscolhida ? "text-mustard" : "text-ink/20"}`}
                aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Conte o que achou (opcional)"
            className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm outline-none focus:border-pine mb-3"
          />
          {erro && <p className="text-xs text-berry mb-3">{erro}</p>}
          <button
            type="submit"
            disabled={enviando || !notaEscolhida}
            className="bg-pine text-white px-5 py-2.5 rounded-full text-sm disabled:opacity-40"
          >
            {enviando ? "Enviando..." : "Enviar avaliação"}
          </button>
        </form>
      )}
    </div>
  );
}
