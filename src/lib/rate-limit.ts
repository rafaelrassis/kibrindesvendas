import "server-only";

// Limitador simples em memória por processo. Não é distribuído — em produção
// com múltiplas instâncias cada uma tem sua própria contagem, então o teto
// real é (limite × nº de instâncias). Mesmo assim já barra o caso comum de
// um script batendo várias vezes seguidas na mesma instância. Se o tráfego
// justificar, trocar por Redis/Upstash é o próximo passo — a assinatura da
// função continua a mesma.
type Registro = { tentativas: number; expiraEm: number };

const registros = new Map<string, Registro>();

// Evita vazamento de memória: limpa entradas expiradas de tempos em tempos
// em vez de a cada chamada (mais barato).
let ultimaLimpeza = Date.now();
function limparExpirados() {
  const agora = Date.now();
  if (agora - ultimaLimpeza < 60_000) return;
  ultimaLimpeza = agora;
  for (const [chave, registro] of registros) {
    if (registro.expiraEm < agora) registros.delete(chave);
  }
}

export type ResultadoRateLimit = { permitido: true } | { permitido: false; espereSegundos: number };

// `chave` deve combinar algo estável por origem (IP) com o recurso (rota),
// pra não misturar contadores de rotas diferentes.
export function checarLimite(
  chave: string,
  limite: number,
  janelaSegundos: number
): ResultadoRateLimit {
  limparExpirados();
  const agora = Date.now();
  const registro = registros.get(chave);

  if (!registro || registro.expiraEm < agora) {
    registros.set(chave, { tentativas: 1, expiraEm: agora + janelaSegundos * 1000 });
    return { permitido: true };
  }

  if (registro.tentativas >= limite) {
    return { permitido: false, espereSegundos: Math.ceil((registro.expiraEm - agora) / 1000) };
  }

  registro.tentativas += 1;
  return { permitido: true };
}

// IP do cliente a partir dos headers que a Vercel/proxy injeta. Sem nenhum
// deles (dev local), cai num valor fixo — ainda limita por não ter IP variando.
export function ipDaRequisicao(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "desconhecido";
}
