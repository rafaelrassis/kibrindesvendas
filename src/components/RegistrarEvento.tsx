"use client";

import { useEffect } from "react";
import type { TipoFunil } from "@/lib/funil";
import { registrarEvento } from "@/lib/funil-client";

export default function RegistrarEvento({ tipo }: { tipo: TipoFunil }) {
  useEffect(() => {
    registrarEvento(tipo);
  }, [tipo]);
  return null;
}
