"use client";

import { useEffect, useRef, useState } from "react";

// Editor de foto usado antes de qualquer upload de imagem no admin (produto,
// categoria, banner). Recorta num retângulo de proporção fixa, deixa dar
// zoom, arrastar e girar em 90°, e devolve sempre um JPEG — isso também
// resolve de graça o problema de fotos HEIC do iPhone: o canvas decodifica e
// reexporta, então o servidor nunca mais recebe um formato que não reconhece.
//
// Não é usado na arte do cliente (upload de arte pronta): lá o arquivo vai
// pra impressão exatamente como enviado, e editar mudaria o que a pessoa
// confirmou como "arte final".

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

export type EditorFotoProps = {
  arquivo: File | null;
  /** largura / altura do recorte final. 1 = quadrado. */
  aspecto?: number;
  /** maior lado da imagem exportada, em px. */
  ladoSaida?: number;
  titulo?: string;
  onCancelar: () => void;
  onConfirmar: (arquivo: File) => void;
};

export default function EditorFoto({
  arquivo,
  aspecto = 1,
  ladoSaida = 900,
  titulo = "Ajustar foto",
  onCancelar,
  onConfirmar,
}: EditorFotoProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [pronto, setPronto] = useState(false);
  const [escala, setEscala] = useState(ZOOM_MIN);
  const [angulo, setAngulo] = useState(0); // 0 | 90 | 180 | 270
  const offset = useRef({ x: 0, y: 0 });
  const arrastoRef = useRef<{ x: number; y: number } | null>(null);
  const pinçaRef = useRef<{ distancia: number; escalaInicial: number } | null>(null);

  // Carrega a imagem quando um arquivo novo chega. Quando `arquivo` vira
  // null o componente não renderiza (return null lá embaixo), então não há
  // necessidade de zerar `pronto` aqui — só quando a nova imagem termina de
  // carregar é que o estado muda (dentro do callback, não no corpo do efeito).
  useEffect(() => {
    if (!arquivo) return;
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      offset.current = { x: 0, y: 0 };
      setEscala(ZOOM_MIN);
      setAngulo(0);
      setPronto(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  function tamanhoTela() {
    const r = stageRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0 };
  }

  function limitarOffset(novaEscala = escala) {
    const { w, h } = tamanhoTela();
    const lim = Math.max(w, h) * 0.6 * novaEscala;
    offset.current.x = Math.max(-lim, Math.min(lim, offset.current.x));
    offset.current.y = Math.max(-lim, Math.min(lim, offset.current.y));
  }

  function desenhar() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !pronto) return;
    const { w, h } = tamanhoTela();
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const girado90 = angulo % 180 !== 0;
    const imgW = girado90 ? img.height : img.width;
    const imgH = girado90 ? img.width : img.height;
    const coverBase = Math.max(w / imgW, h / imgH);
    const cover = coverBase * escala;

    ctx.save();
    ctx.translate(w / 2 + offset.current.x, h / 2 + offset.current.y);
    ctx.rotate((angulo * Math.PI) / 180);
    ctx.scale(cover, cover);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  // Redesenha sempre que zoom/ângulo mudam, quando a imagem termina de
  // carregar, ou quando a tela muda de tamanho (ex: rotação do celular).
  useEffect(() => {
    desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escala, angulo, pronto]);

  useEffect(() => {
    if (!pronto) return;
    const onResize = () => desenhar();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto]);

  // Arraste e pinça precisam de listeners nativos (não sintéticos) porque o
  // touchmove tem que poder chamar preventDefault pra não rolar a página
  // enquanto a pessoa move a foto — o React trata touch como passivo.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pronto) return;

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

    function iniciar(e: MouseEvent | TouchEvent) {
      if ("touches" in e && e.touches.length === 2) {
        pinçaRef.current = { distancia: distanciaEntreToques(e.touches), escalaInicial: escala };
        arrastoRef.current = null;
        return;
      }
      arrastoRef.current = posDoEvento(e);
    }

    function mover(e: MouseEvent | TouchEvent) {
      if ("touches" in e && e.touches.length === 2 && pinçaRef.current) {
        const nova = distanciaEntreToques(e.touches);
        const novaEscala = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, pinçaRef.current.escalaInicial * (nova / pinçaRef.current.distancia))
        );
        limitarOffset(novaEscala);
        setEscala(novaEscala);
        e.preventDefault();
        return;
      }
      if (!arrastoRef.current) return;
      const p = posDoEvento(e);
      offset.current.x += p.x - arrastoRef.current.x;
      offset.current.y += p.y - arrastoRef.current.y;
      arrastoRef.current = p;
      limitarOffset();
      desenhar();
      e.preventDefault();
    }

    function soltar() {
      arrastoRef.current = null;
      pinçaRef.current = null;
    }

    canvas.addEventListener("mousedown", iniciar);
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    canvas.addEventListener("touchstart", iniciar, { passive: true });
    canvas.addEventListener("touchmove", mover, { passive: false });
    canvas.addEventListener("touchend", soltar);

    return () => {
      canvas.removeEventListener("mousedown", iniciar);
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      canvas.removeEventListener("touchstart", iniciar);
      canvas.removeEventListener("touchmove", mover);
      canvas.removeEventListener("touchend", soltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, escala]);

  function resetar() {
    offset.current = { x: 0, y: 0 };
    setEscala(ZOOM_MIN);
    setAngulo(0);
  }

  function confirmar() {
    const img = imgRef.current;
    if (!img || !arquivo) return;

    const { w, h } = tamanhoTela();
    const saidaW = aspecto >= 1 ? ladoSaida : ladoSaida * aspecto;
    const saidaH = aspecto >= 1 ? ladoSaida / aspecto : ladoSaida;
    const saida = document.createElement("canvas");
    saida.width = saidaW;
    saida.height = saidaH;
    const ctx = saida.getContext("2d");
    if (!ctx) return;

    const fator = saidaW / w;
    const girado90 = angulo % 180 !== 0;
    const imgW = girado90 ? img.height : img.width;
    const imgH = girado90 ? img.width : img.height;
    const coverBase = Math.max(w / imgW, h / imgH);
    const cover = coverBase * escala * fator;

    ctx.save();
    ctx.translate(saidaW / 2 + offset.current.x * fator, saidaH / 2 + offset.current.y * fator);
    ctx.rotate((angulo * Math.PI) / 180);
    ctx.scale(cover, cover);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    saida.toBlob(
      (blob) => {
        if (!blob) return;
        const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
        onConfirmar(new File([blob], nome, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  if (!arquivo) return null;

  return (
    <div className="fixed inset-0 bg-ink/55 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCancelar}
            className="text-ink/50 text-xl leading-none px-1"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div
          ref={stageRef}
          className="relative bg-paper-2 overflow-hidden touch-none select-none"
          style={{ aspectRatio: aspecto }}
        >
          <canvas ref={canvasRef} className="block w-full h-full cursor-grab active:cursor-grabbing" />
          <div className="absolute inset-0 pointer-events-none border border-white/70 shadow-[0_0_0_2000px_rgba(0,0,0,0.45)]">
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
          </div>
        </div>

        <div className="px-4 pt-3.5">
          <div className="flex items-center gap-2.5 mb-3.5">
            <span className="text-ink/40 text-sm w-4 text-center">−</span>
            <input
              type="range"
              min={ZOOM_MIN * 100}
              max={ZOOM_MAX * 100}
              value={escala * 100}
              onChange={(e) => {
                const nova = Number(e.target.value) / 100;
                limitarOffset(nova);
                setEscala(nova);
              }}
              className="flex-1 accent-pine"
            />
            <span className="text-ink/40 text-sm w-4 text-center">+</span>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setAngulo((a) => (a - 90 + 360) % 360)}
              className="flex-1 flex flex-col items-center gap-1 bg-paper-2 border border-line rounded-lg py-2.5 text-[10.5px] text-ink"
            >
              <span className="text-lg leading-none">↺</span>Girar
            </button>
            <button
              type="button"
              onClick={() => setAngulo((a) => (a + 90) % 360)}
              className="flex-1 flex flex-col items-center gap-1 bg-paper-2 border border-line rounded-lg py-2.5 text-[10.5px] text-ink"
            >
              <span className="text-lg leading-none">↻</span>Girar
            </button>
            <button
              type="button"
              onClick={resetar}
              className="flex-1 flex flex-col items-center gap-1 bg-paper-2 border border-line rounded-lg py-2.5 text-[10.5px] text-ink"
            >
              <span className="text-lg leading-none">⟲</span>Resetar
            </button>
          </div>
        </div>

        <div className="flex gap-2.5 px-4 py-3 border-t border-line">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 border border-line rounded-full py-2.5 text-[13.5px] text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            className="flex-1 bg-pine text-white rounded-full py-2.5 text-[13.5px] font-medium"
          >
            Usar foto
          </button>
        </div>
      </div>
    </div>
  );
}
