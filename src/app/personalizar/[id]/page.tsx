"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useProduto } from "@/lib/use-produto";
import { useCart, type ViaPersonalizacao } from "@/lib/cart-context";

const vias: { id: ViaPersonalizacao; label: string; emoji: string; descricao: string }[] = [
  {
    id: "UPLOAD",
    label: "Enviar arte pronta",
    emoji: "📤",
    descricao: "Faça upload do arquivo final. Impressão exatamente como enviado.",
  },
  {
    id: "MANUAL",
    label: "Criar com a gente",
    emoji: "💬",
    descricao: "Fala direto com a loja no WhatsApp e a gente desenvolve a arte junto com você.",
  },
  // "IA" segue existindo no tipo (cart-context) mas escondida da seleção por
  // enquanto — a geração ainda é só uma simulação, sem IA de verdade por trás.
];

// Número da loja pro atendimento manual — configurado uma vez, vale pra todo
// mundo por enquanto (sem fila por atendente/categoria ainda).
const WHATSAPP_LOJA = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;

export default function PersonalizarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { produto } = useProduto(id);
  const { item, definirPersonalizacao } = useCart();

  const [via, setVia] = useState<ViaPersonalizacao>("UPLOAD");
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [arteUrl, setArteUrl] = useState<string | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [erroUpload, setErroUpload] = useState("");
  // Marca que a pessoa já clicou pra abrir a conversa — é o que libera
  // confirmar e seguir pro pagamento na via manual.
  const [contatoIniciado, setContatoIniciado] = useState(false);
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

  // Só vale como arte pronta depois que o arquivo chegou no servidor (upload)
  // ou depois que a pessoa abriu a conversa no WhatsApp (manual) — o nome do
  // arquivo aparece na hora, mas o upload em si pode falhar.
  const artePronta =
    (via === "UPLOAD" && !!arteUrl) || (via === "MANUAL" && contatoIniciado);

  const resumoVariacoes = Object.entries(item.variacoesEscolhidas)
    .map(([tipo, valor]) => `${tipo}: ${valor}`)
    .join(", ");
  const mensagemWhatsapp = `Olá! Quero personalizar o produto "${produto.nome}"${
    resumoVariacoes ? ` (${resumoVariacoes})` : ""
  }. Vim pelo site e quero desenvolver a arte junto com vocês.`;
  const linkWhatsapp = WHATSAPP_LOJA
    ? `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(mensagemWhatsapp)}`
    : null;

  async function selecionarArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setArquivoNome(arquivo.name);
    setArteUrl(null);
    setErroUpload("");
    setEnviandoArquivo(true);

    const form = new FormData();
    form.append("arquivo", arquivo);

    try {
      const r = await fetch("/api/upload", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Falha no upload.");
      setArteUrl(data.url);
    } catch (e) {
      setErroUpload(e instanceof Error ? e.message : "Falha no upload.");
      setArquivoNome(null);
    } finally {
      setEnviandoArquivo(false);
    }
  }

  function confirmar() {
    if (!aceite) return;
    const resumo =
      via === "UPLOAD"
        ? `Arte enviada pelo cliente — ${arquivoNome}`
        : "Arte combinada com o cliente por WhatsApp";

    definirPersonalizacao({
      via,
      resumo,
      aceite: true,
      aceiteEm: new Date().toISOString(),
      ...(arteUrl && { arteUrl }),
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
        {via === "UPLOAD" && (
          <div className="space-y-4">
            <label className="block border-2 border-dashed border-line rounded-md p-8 text-center cursor-pointer hover:border-mustard transition-colors">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => selecionarArquivo(e.target.files?.[0])}
              />
              <div className="text-3xl mb-2">📤</div>
              <p className="text-sm font-medium">
                {enviandoArquivo
                  ? "Enviando..."
                  : arquivoNome ?? "Clique pra selecionar o arquivo final"}
              </p>
              <p className="text-xs text-ink/50 mt-1">PNG, JPG, WEBP ou PDF · até 15MB</p>
            </label>
            {arteUrl && <p className="text-xs text-pine-2">✓ Arquivo enviado com sucesso.</p>}
            {erroUpload && <p className="text-xs text-berry">{erroUpload}</p>}
          </div>
        )}

        {via === "MANUAL" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-paper-2 rounded-lg p-4">
              <span className="text-2xl shrink-0">💬</span>
              <div>
                <p className="text-sm font-medium mb-1">Vamos combinar direto com você</p>
                <p className="text-xs text-ink/60">
                  Chama a gente no WhatsApp e nossa equipe desenvolve a arte junto com você —
                  com fotos, referências e aprovação antes de ir pra produção.
                </p>
              </div>
            </div>

            {linkWhatsapp ? (
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setContatoIniciado(true)}
                className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-medium px-5 py-3 rounded-full text-sm hover:brightness-95 transition"
              >
                💬 Falar no WhatsApp
              </a>
            ) : (
              // Sem o número configurado (NEXT_PUBLIC_WHATSAPP_LOJA), avisa em
              // vez de mostrar um botão quebrado.
              <p className="text-xs text-berry">
                Atendimento por WhatsApp ainda não configurado — fale com o time técnico.
              </p>
            )}

            {contatoIniciado && (
              <p className="text-xs text-pine-2">
                ✓ Você abriu a conversa. Quando combinar a arte com a loja, confirme abaixo pra
                seguir.
              </p>
            )}
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
              : "Confirmo que já entrei em contato pelo WhatsApp pra combinar a arte com a loja."}
          </span>
        </label>
      )}

      <button
        onClick={confirmar}
        disabled={!artePronta || !aceite || enviandoArquivo}
        className="w-full md:w-auto bg-berry text-paper font-medium px-8 py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
      >
        Confirmar arte e ir pro pagamento
      </button>
    </div>
  );
}
