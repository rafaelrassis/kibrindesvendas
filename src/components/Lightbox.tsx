"use client";

import { useEffect, useRef, useState } from "react";

// Visualização em tela cheia da foto do produto — abre ao tocar na imagem
// principal da galeria. Dá zoom (pinça ou duplo toque) e arraste; setas/swipe
// trocam de foto sem fechar. Diferente do EditorFoto do admin: aqui é só
// visualização, não gera nada pra upload.
//
// O componente só existe montado enquanto o lightbox está aberto (quem
// controla isso é ProdutoGaleria) — por isso `indiceInicial` só precisa
// inicializar o estado, nunca sincronizar com ele depois.

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

export type LightboxItem = { tipo: "foto" | "video"; url: string };

export default function Lightbox({
  itens,
  indiceInicial,
  nome,
  onFechar,
}: {
  itens: LightboxItem[];
  indiceInicial: number;
  nome: string;
  onFechar: () => void;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const [escala, setEscala] = useState(ZOOM_MIN);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const arrastoRef = useRef<{ x: number; y: number } | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const pinçaRef = useRef<{ distancia: number; escalaInicial: number } | null>(null);

  // Trava o scroll da página por trás enquanto o lightbox está aberto.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  function resetarZoom() {
    setEscala(ZOOM_MIN);
    setOffset({ x: 0, y: 0 });
  }

  function trocar(novoIndice: number) {
    setIndice((novoIndice + itens.length) % itens.length);
    resetarZoom();
  }

  const item = itens[indice];

  useEffect(() => {
    const el = stageRef.current;
    if (!el || item.tipo === "video") return;

    function posDoEvento(e: MouseEvent | TouchEvent) {
      if ("touches" in e && e.touches[0]) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      const me = e as MouseEvent;
      return { x: me.clientX, y: me.clientY };
    }
    function distanciaEntreToques(t: TouchList) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    }

    function aoIniciar(e: MouseEvent | TouchEvent) {
      if ("touches" in e && e.touches.length === 2) {
        pinçaRef.current = { distancia: distanciaEntreToques(e.touches), escalaInicial: escala };
        arrastoRef.current = null;
        swipeRef.current = null;
        return;
      }
      const p = posDoEvento(e);
      if (escala > ZOOM_MIN) {
        arrastoRef.current = p;
      } else {
        swipeRef.current = p; // sem zoom, o gesto é pra trocar de foto
      }
    }

    function aoMover(e: MouseEvent | TouchEvent) {
      if ("touches" in e && e.touches.length === 2 && pinçaRef.current) {
        const nova = distanciaEntreToques(e.touches);
        setEscala(
          Math.max(
            ZOOM_MIN,
            Math.min(ZOOM_MAX, pinçaRef.current.escalaInicial * (nova / pinçaRef.current.distancia))
          )
        );
        e.preventDefault();
        return;
      }
      if (arrastoRef.current) {
        const p = posDoEvento(e);
        setOffset((o) => ({ x: o.x + p.x - arrastoRef.current!.x, y: o.y + p.y - arrastoRef.current!.y }));
        arrastoRef.current = p;
        e.preventDefault();
      }
    }

    function aoSoltar(e: MouseEvent | TouchEvent) {
      pinçaRef.current = null;
      arrastoRef.current = null;
      if (!swipeRef.current) return;
      const fim =
        "changedTouches" in e && e.changedTouches[0]
          ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
          : posDoEvento(e);
      const dx = fim.x - swipeRef.current.x;
      swipeRef.current = null;
      if (Math.abs(dx) > 50 && itens.length > 1) {
        trocar(indice + (dx < 0 ? 1 : -1));
      }
    }

    el.addEventListener("mousedown", aoIniciar);
    window.addEventListener("mousemove", aoMover);
    window.addEventListener("mouseup", aoSoltar);
    el.addEventListener("touchstart", aoIniciar, { passive: true });
    el.addEventListener("touchmove", aoMover, { passive: false });
    el.addEventListener("touchend", aoSoltar);

    return () => {
      el.removeEventListener("mousedown", aoIniciar);
      window.removeEventListener("mousemove", aoMover);
      window.removeEventListener("mouseup", aoSoltar);
      el.removeEventListener("touchstart", aoIniciar);
      el.removeEventListener("touchmove", aoMover);
      el.removeEventListener("touchend", aoSoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escala, indice, item.tipo]);

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/70 text-xs">
          {itens.length > 1 ? `${indice + 1} / ${itens.length}` : nome}
        </span>
        <button
          type="button"
          onClick={onFechar}
          className="text-white text-2xl leading-none px-2"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>

      <div ref={stageRef} className="flex-1 relative overflow-hidden touch-none select-none">
        {item.tipo === "video" ? (
          <video
            src={item.url}
            className="w-full h-full object-contain"
            controls
            playsInline
            autoPlay
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            onDoubleClick={() => (escala > ZOOM_MIN ? resetarZoom() : setEscala(2.2))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={nome}
              className="max-w-full max-h-full object-contain pointer-events-none"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${escala})` }}
              draggable={false}
            />
          </div>
        )}

        {itens.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => trocar(indice - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/15 text-white text-lg flex items-center justify-center"
              aria-label="Foto anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => trocar(indice + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/15 text-white text-lg flex items-center justify-center"
              aria-label="Próxima foto"
            >
              ›
            </button>
          </>
        )}
      </div>

      {itens.length > 1 && (
        <div className="flex justify-center gap-1.5 py-3 shrink-0">
          {itens.map((it, i) => (
            <button
              key={it.url}
              type="button"
              onClick={() => trocar(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === indice ? "bg-white" : "bg-white/30"
              }`}
              aria-label={`Ir pra foto ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
