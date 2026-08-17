"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BannerAdmin } from "@/lib/types";

export default function AdminBannerForm({ banner }: { banner?: BannerAdmin }) {
  const router = useRouter();
  const editando = !!banner;

  const [titulo, setTitulo] = useState(banner?.titulo ?? "");
  const [eyebrow, setEyebrow] = useState(banner?.eyebrow ?? "");
  const [precoTexto, setPrecoTexto] = useState(banner?.precoTexto ?? "");
  const [ctaHref, setCtaHref] = useState(banner?.ctaHref ?? "/");
  const [corFundo, setCorFundo] = useState(banner?.corFundo ?? "#3F6B4C");
  const [imagemUrl, setImagemUrl] = useState<string | null>(banner?.imagemUrl ?? null);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // A imagem sobe na hora e o formulário guarda só a URL que o servidor
  // devolveu — é ela, e não um endereço digitado, que a home aceita.
  async function selecionarImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro("");
    setEnviandoImagem(true);

    const form = new FormData();
    form.append("arquivo", arquivo);

    try {
      const r = await fetch("/api/admin/imagens", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Não foi possível enviar a imagem.");
      setImagemUrl(data.url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviandoImagem(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!titulo.trim() || !ctaHref.trim()) {
      setErro("Preencha título e link de destino.");
      return;
    }

    setEnviando(true);
    const r = await fetch(editando ? `/api/admin/banners/${banner.id}` : "/api/admin/banners", {
      method: editando ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, eyebrow, precoTexto, ctaHref, imagemUrl, corFundo }),
    });
    const data = await r.json();
    setEnviando(false);

    if (!r.ok) {
      setErro(data.error ?? "Não foi possível salvar o banner.");
      return;
    }

    router.push("/admin/banners");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="space-y-4 max-w-xl">
      <div
        className="rounded-xl h-40 flex items-center bg-cover bg-center relative overflow-hidden"
        style={{
          backgroundColor: corFundo,
          backgroundImage: imagemUrl ? `url(${imagemUrl})` : undefined,
        }}
      >
        {imagemUrl && <div className="absolute inset-0 bg-black/25" />}
        <div className="px-6 text-white relative">
          <p className="uppercase text-[11px] tracking-widest text-white/70 mb-1">
            {eyebrow || "eyebrow"}
          </p>
          <p className="font-display text-2xl leading-tight mb-2">{titulo || "Título do banner"}</p>
          {precoTexto && (
            <p className="bg-white text-ink inline-block text-sm font-medium px-3 py-1 rounded-full">
              {precoTexto}
            </p>
          )}
        </div>
      </div>

      <div>
        <span className="block text-xs text-ink/50 mb-1.5">
          Imagem (opcional — sem imagem, o slide usa a cor de fundo)
        </span>
        <label className="block border-2 border-dashed border-line rounded-md p-4 text-center cursor-pointer hover:border-mustard transition-colors">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={enviandoImagem}
            onChange={(e) => selecionarImagem(e.target.files?.[0])}
          />
          <span className="text-sm text-ink/50">
            {enviandoImagem
              ? "Enviando..."
              : imagemUrl
                ? "Trocar imagem"
                : "Clique pra escolher uma imagem (PNG, JPG ou WEBP, até 5MB)"}
          </span>
        </label>
        {imagemUrl && (
          <button
            type="button"
            onClick={() => setImagemUrl(null)}
            className="text-berry text-xs hover:underline mt-2"
          >
            Remover imagem
          </button>
        )}
      </div>

      <Campo label="Eyebrow (texto pequeno acima do título)">
        <input
          value={eyebrow}
          onChange={(e) => setEyebrow(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          placeholder="Ex: Novidade"
        />
      </Campo>

      <Campo label="Título">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          required
        />
      </Campo>

      <Campo label="Texto do selo (preço ou chamada)">
        <input
          value={precoTexto}
          onChange={(e) => setPrecoTexto(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          placeholder="Ex: A partir de R$ 24,90"
        />
      </Campo>

      <Campo label="Link de destino (caminho da loja)">
        <input
          value={ctaHref}
          onChange={(e) => setCtaHref(e.target.value)}
          className="w-full border border-line rounded px-3 py-2 text-sm"
          placeholder="/categoria/imas"
          required
        />
      </Campo>

      <Campo label="Cor de fundo (usada quando não há imagem)">
        <input
          type="color"
          value={corFundo}
          onChange={(e) => setCorFundo(e.target.value)}
          className="w-full border border-line rounded px-3 py-1 h-10"
        />
      </Campo>

      {erro && <p className="text-sm text-berry">{erro}</p>}

      <button
        type="submit"
        disabled={enviando || enviandoImagem}
        className="bg-pine text-white px-6 py-2.5 rounded-full text-sm disabled:opacity-50"
      >
        {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Criar banner"}
      </button>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink/50 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
