"use client";

export default function HomeTopBar() {
  return (
    <div className="bg-pine">
      <div className="mx-auto max-w-6xl px-5 pt-2 pb-8">
        <div className="tag-shape tag-hole bg-white text-ink px-5 py-4 flex items-center justify-between max-w-md">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/50">Etiqueta de presente</p>
            <p className="font-display text-lg">Pra: Vó Marlene 💛</p>
          </div>
          <span className="text-2xl">🎁</span>
        </div>
      </div>
    </div>
  );
}
