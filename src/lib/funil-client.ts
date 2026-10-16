"use client";

import type { TipoFunil } from "./funil";

function sessaoId(): string | null {
  try {
    let id = localStorage.getItem("funil-sessao");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("funil-sessao", id);
    }
    return id;
  } catch {
    return null;
  }
}

// Melhor esforço: nunca atrapalha a navegação. Cada tipo é enviado uma vez por
// aba (sessionStorage); o servidor ainda deduplica por dia.
export function registrarEvento(tipo: TipoFunil, produtoId = "") {
  try {
    const sessao = sessaoId();
    if (!sessao) return;
    if (sessionStorage.getItem("funil-off")) return;
    const marca = `funil-${tipo}-${produtoId}`;
    if (sessionStorage.getItem(marca)) return;
    sessionStorage.setItem(marca, "1");
    fetch("/api/funil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessao, tipo, produtoId }),
      keepalive: true,
    })
      .then((r) => r.json())
      .then((d: { ativo?: boolean }) => {
        if (d.ativo === false) {
          // Funil desligado: esquece o id e para de tentar nesta aba.
          sessionStorage.setItem("funil-off", "1");
          localStorage.removeItem("funil-sessao");
        }
      })
      .catch(() => {});
  } catch {
    // sem storage (modo privado): segue sem registrar
  }
}
