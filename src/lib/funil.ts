// Funil anônimo da loja: só um id aleatório de sessão (sem dados pessoais) e o
// tipo do passo. O servidor guarda no máximo 1 evento por sessão/tipo/dia.

export const TIPOS_FUNIL = ["produto_visto", "carrinho_add", "checkout_iniciado"] as const;
export type TipoFunil = (typeof TIPOS_FUNIL)[number];

export function tipoFunilValido(v: unknown): v is TipoFunil {
  return typeof v === "string" && (TIPOS_FUNIL as readonly string[]).includes(v);
}

export const SESSAO_VALIDA = /^[A-Za-z0-9-]{8,64}$/;
