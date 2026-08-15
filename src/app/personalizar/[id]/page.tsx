"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getProduto } from "@/lib/mock-data";
import { useCart, type ViaPersonalizacao } from "@/lib/cart-context";

const vias: { id: ViaPersonalizacao; label: string; emoji: string; descricao: string }[] = [
  {
    id: "IA",
    label: "Gerar via IA",
    emoji: "✨",
    descricao: "Envie uma foto e/ou descrição, escolha um estilo e gere uma prévia.",
  },
  {
    id: "UPLOAD",
    label: "Enviar arte pronta",
    emoji: "📤",
    descricao: "Faça upload do arquivo final. Impressão exatamente como enviado.",
  },
  {
    id: "MANUAL",
    label: "Manual pela loja",
    emoji: "🖊️",
    descricao: "Descreva o que quer e nossa equipe desenvolve a arte pra você.",
  },
];

const estilosIA = ["Aquarela", "Cartoon", "Minimalista", "Festa Junina"];

export default function PersonalizarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const produto = getProduto(id);
  const { item, definirPersonalizacao } = useCart();

  const [via, setVia] = useState<ViaPersonalizacao>("IA");
  const [estilo, setEstilo] = useState(estilosIA[0]);
  const [descricaoIA, setDescricaoIA] = useState("");
  const [previewGerado, setPreviewGerado] = useState(false);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [briefing, setBriefing] = useState("");
  const [aceite, setAceite] = useState(false);

  if (!produto) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-ink/60">Produto não encontrado.</p>
      </div>
    );
  }

  if (!item || item.produtoId !== produto.id) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-ink/60 mb-4">
          Escolha as variações do produto antes de personalizar.
        </p>
        <button
          onClick={() => router.push(`/produto/${produto.id}`)}
          className="bg-pine text-paper px-6 py-2.5 rounded-full text-sm"
        >
          Voltar pro produto
        </button>
      </div>
    );
  }

  const artePronta =
    (via === "IA" && previewGerado) ||
    (via === "UPLOAD" && !!arquivoNome) ||
    (via === "MANUAL" && briefing.trim().length > 5);

  function confirmar() {
    if (!aceite) return;
    const resumo =
      via === "IA"
        ? `Prévia gerada por IA — estilo ${estilo}`
        : via === "UPLOAD"
        ? `Arte enviada pelo cliente — ${arquivoNome}`
        : `Briefing pra loja desenvolver: "${briefing}"`;

    definirPersonalizacao({
      via,
      resumo,
      aceite: true,
      aceiteEm: new Date().toISOString(),
    });
    router.push("/checkout");
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">
        Personalização · {produto.nome}
      </p>
      <h1 className="font-display text-3xl mb-8">Como você quer criar a arte?</h1>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {vias.map((v) => (
          <button
            key={v.id}
            onClick={() => setVia(v.id)}
            className={`text-left p-4 rounded-lg border transition-colors ${
              via === v.id
                ? "bg-pine text-paper border-pine"
                : "bg-white border-line hover:border-pine/40"
            }`}
          >
            <div className="text-2xl mb-2">{v.emoji}</div>
            <p className="font-medium text-sm mb-1">{v.label}</p>
            <p className={`text-xs ${via === v.id ? "text-paper/70" : "text-ink/50"}`}>
              {v.descricao}
            </p>
          </button>
        ))}
      </div>

      <div className="bg-white border border-line rounded-lg p-6 mb-8">
        {via === "IA" && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium block mb-2">
                Descreva ou cole o link da foto de referência
              </label>
              <textarea
                value={descricaoIA}
                onChange={(e) => setDescricaoIA(e.target.value)}
                placeholder="Ex: foto do meu cachorro Toby, um vira-lata caramelo..."
                className="w-full border border-line rounded-md px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-mustard/50"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Estilo</p>
              <div className="flex flex-wrap gap-2">
                {estilosIA.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setEstilo(e);
                      setPreviewGerado(false);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      estilo === e
                        ? "bg-mustard/20 border-mustard text-pine-2"
                        : "border-line"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setPreviewGerado(true)}
              disabled={!descricaoIA.trim()}
              className="bg-pine text-paper text-sm px-5 py-2.5 rounded-full disabled:opacity-40"
            >
              Gerar prévia
            </button>

            {previewGerado && (
              <div className="pt-2">
                <div
                  className="aspect-video rounded-md flex items-center justify-center text-5xl"
                  style={{ backgroundColor: `${produto.cor}22` }}
                >
                  🖼️ {produto.emoji}
                </div>
                <p className="text-xs text-ink/50 mt-2">
                  Simulação — o resultado impresso pode variar levemente, principalmente em produtos têxteis.
                </p>
                <button
                  onClick={() => setPreviewGerado(false)}
                  className="text-sm text-berry mt-2 underline"
                >
                  Gerar outra prévia
                </button>
              </div>
            )}
          </div>
        )}

        {via === "UPLOAD" && (
          <div className="space-y-4">
            <label className="block border-2 border-dashed border-line rounded-md p-8 text-center cursor-pointer hover:border-mustard transition-colors">
              <input
                type="file"
                className="hidden"
                onChange={(e) => setArquivoNome(e.target.files?.[0]?.name ?? null)}
              />
              <div className="text-3xl mb-2">📤</div>
              <p className="text-sm font-medium">
                {arquivoNome ?? "Clique pra selecionar o arquivo final"}
              </p>
              <p className="text-xs text-ink/50 mt-1">PNG, JPG ou PDF em alta resolução</p>
            </label>
          </div>
        )}

        {via === "MANUAL" && (
          <div>
            <label className="text-sm font-medium block mb-2">
              Descreva o que você quer que a gente crie
            </label>
            <textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              placeholder="Ex: quero uma arte com o nome 'Família Silva' e os 4 cachorros da casa..."
              className="w-full border border-line rounded-md px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-mustard/50"
            />
            <p className="text-xs text-ink/50 mt-2">
              Nossa equipe vai desenvolver a arte e te enviar pra aprovação antes da impressão.
            </p>
          </div>
        )}
      </div>

      {artePronta && (
        <label className="flex items-start gap-3 bg-white border border-line rounded-lg p-4 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-ink/80">
            {via === "UPLOAD"
              ? "Confirmo que a arte enviada será impressa exatamente como está, e isento a loja de responsabilidade sobre o conteúdo e qualidade do arquivo."
              : "Confirmo que aprovo esta arte pra seguir pra produção."}
          </span>
        </label>
      )}

      <button
        onClick={confirmar}
        disabled={!artePronta || !aceite}
        className="w-full md:w-auto bg-berry text-paper font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
      >
        Confirmar arte e ir pro pagamento
      </button>
    </div>
  );
}
