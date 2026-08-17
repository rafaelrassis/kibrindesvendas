"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import type { BannerAdmin } from "@/lib/types";

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<BannerAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/admin/banners")
      .then((r) => r.json())
      .then((lista) => setBanners(Array.isArray(lista) ? lista : []))
      .finally(() => setCarregando(false));
  }, []);

  async function alternarAtivo(banner: BannerAdmin) {
    setErro("");
    const r = await fetch(`/api/admin/banners/${banner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !banner.ativo }),
    });
    if (!r.ok) {
      setErro("Não foi possível mudar a visibilidade do banner.");
      return;
    }
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, ativo: !b.ativo } : b))
    );
  }

  // A tela troca dois vizinhos e manda o carrossel inteiro na ordem nova; o
  // servidor renumera de uma vez. Se falhar, volta pra ordem de antes.
  async function mover(index: number, direcao: -1 | 1) {
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= banners.length) return;

    const anterior = banners;
    const nova = [...banners];
    [nova[index], nova[alvo]] = [nova[alvo], nova[index]];
    setBanners(nova);
    setErro("");

    const r = await fetch("/api/admin/banners", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: nova.map((b) => b.id) }),
    });
    if (!r.ok) {
      setBanners(anterior);
      setErro("Não foi possível salvar a nova ordem.");
    }
  }

  async function remover(id: string) {
    setErro("");
    const r = await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErro("Não foi possível remover o banner.");
      return;
    }
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Banners</h1>
      <p className="text-ink/60 mb-2 text-sm">
        Área interna — o carrossel de destaque no topo da home.
      </p>
      <AdminNav />

      <Link
        href="/admin/banners/novo"
        className="inline-block bg-pine text-white px-5 py-2.5 rounded-full text-sm mb-6 hover:brightness-110 transition"
      >
        + Novo banner
      </Link>

      {erro && <p className="text-sm text-berry mb-4">{erro}</p>}

      {carregando && <p className="text-ink/50 text-sm">Carregando...</p>}

      {!carregando && banners.length === 0 && (
        <p className="text-ink/50 text-sm">
          Nenhum banner cadastrado — a home fica sem o carrossel até você criar o primeiro.
        </p>
      )}

      <div className="space-y-3">
        {banners.map((b, i) => (
          <div
            key={b.id}
            className={`flex items-center gap-4 bg-white border border-line rounded-lg p-3 ${
              b.ativo ? "" : "opacity-50"
            }`}
          >
            <div
              className="w-20 h-14 rounded-md shrink-0 bg-cover bg-center flex items-center justify-center text-white/70 text-[10px] text-center px-1"
              style={{
                backgroundColor: b.corFundo,
                backgroundImage: b.imagemUrl ? `url(${b.imagemUrl})` : undefined,
              }}
            >
              {!b.imagemUrl && "sem imagem"}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{b.titulo}</p>
              <p className="text-xs text-ink/50 truncate">
                {b.eyebrow ? `${b.eyebrow} · ` : ""}
                {b.ctaHref}
              </p>
            </div>

            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => mover(i, -1)}
                disabled={i === 0}
                aria-label="Subir banner"
                className="text-xs text-ink/50 disabled:opacity-20"
              >
                ▲
              </button>
              <button
                onClick={() => mover(i, 1)}
                disabled={i === banners.length - 1}
                aria-label="Descer banner"
                className="text-xs text-ink/50 disabled:opacity-20"
              >
                ▼
              </button>
            </div>

            <button
              onClick={() => alternarAtivo(b)}
              className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                b.ativo ? "bg-mustard/20 text-pine" : "bg-ink/5 text-ink/50"
              }`}
            >
              {b.ativo ? "Ativo" : "Inativo"}
            </button>

            <Link
              href={`/admin/banners/${b.id}/editar`}
              className="text-pine text-xs hover:underline shrink-0"
            >
              Editar
            </Link>
            <button
              onClick={() => remover(b.id)}
              className="text-berry text-xs hover:underline shrink-0"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
