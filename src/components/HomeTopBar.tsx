"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomeTopBar() {
  const [termo, setTermo] = useState("");
  const router = useRouter();

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/busca?q=${encodeURIComponent(termo)}`);
  };

  return (
    <div className="bg-pine">
      <div className="mx-auto max-w-6xl px-5 pt-5 pb-8">
        <form onSubmit={buscar}>
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Busca na LeoKibrindes"
            className="w-full bg-white text-ink rounded-full px-5 py-3.5 text-sm outline-none shadow-sm"
          />
        </form>
      </div>
    </div>
  );
}
