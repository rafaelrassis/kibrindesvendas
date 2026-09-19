"use client";

export default function AdminDreImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="px-3 py-2 rounded border border-line bg-white text-sm print:hidden"
    >
      Imprimir / PDF
    </button>
  );
}
