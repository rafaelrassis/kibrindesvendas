"use client";

import { useEffect, useState } from "react";
import type { Pedido } from "@/lib/types";

// Os pedidos do usuário logado. Visitante recebe lista vazia da API, então a
// tela não precisa tratar 401 — quem convida a entrar é o próprio componente.
export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    fetch("/api/pedidos")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Pedido[]) => {
        if (ativo) setPedidos(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (ativo) setPedidos([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { pedidos, carregando };
}
