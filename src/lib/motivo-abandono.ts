export const MOTIVOS_ABANDONO = [
  { valor: "frete", rotulo: "O frete ficou caro" },
  { valor: "preco", rotulo: "O preço" },
  { valor: "duvida", rotulo: "Fiquei com dúvida" },
  { valor: "outro", rotulo: "Outro motivo" },
] as const;

export type MotivoAbandono = (typeof MOTIVOS_ABANDONO)[number]["valor"];

export function motivoValido(v: unknown): v is MotivoAbandono {
  return typeof v === "string" && MOTIVOS_ABANDONO.some((m) => m.valor === v);
}
