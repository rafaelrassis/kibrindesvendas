import "server-only";

// Sem UPSTASH_REDIS_REST_URL/TOKEN configuradas (dev local, ou loja que ainda
// não criou a integração), o limite roda em memória do processo — mesmo
// critério do e-mail/pagamento cair em modo simulado sem credencial. Na
// Vercel isso é bem mais frágil que o normal desse padrão: cada invocação de
// function pode ser uma instância nova, então o contador zera direto e o
// limite não segura nada de verdade. Por isso o Redis é o caminho principal
// em produção, com isto aqui só de rede de segurança pro dev local.
function redisConfigurado() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

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

function checarLimiteEmMemoria(
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

// Uma única chamada de pipeline: incrementa, grava o TTL da janela só na
// primeira vez (NX — chamadas seguintes não reiniciam o relógio) e lê o TTL
// atual pra saber quanto falta caso bloqueie. Contagem em janela fixa: as
// primeiras `limite` chamadas dentro da janela passam, a de número
// `limite + 1` é barrada — mesmo comportamento do limitador em memória.
async function checarLimiteNoRedis(
  chave: string,
  limite: number,
  janelaSegundos: number,
  redis: { url: string; token: string }
): Promise<ResultadoRateLimit> {
  const resposta = await fetch(`${redis.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", chave],
      ["EXPIRE", chave, String(janelaSegundos), "NX"],
      ["TTL", chave],
    ]),
  });
  if (!resposta.ok) throw new Error(`Upstash respondeu ${resposta.status}`);

  const [incrementado, , tempoRestante] = (await resposta.json()) as { result: number }[];
  const tentativas = Number(incrementado.result);
  const ttl = Number(tempoRestante.result);

  if (tentativas > limite) {
    return { permitido: false, espereSegundos: ttl > 0 ? ttl : janelaSegundos };
  }
  return { permitido: true };
}

// `chave` deve combinar algo estável por origem (IP) com o recurso (rota),
// pra não misturar contadores de rotas diferentes.
//
// Falha de rede/config do Redis não pode travar o login pra todo mundo: cai
// pro limitador em memória daquela instância em vez de propagar o erro.
export async function checarLimite(
  chave: string,
  limite: number,
  janelaSegundos: number
): Promise<ResultadoRateLimit> {
  const redis = redisConfigurado();
  if (redis) {
    try {
      return await checarLimiteNoRedis(chave, limite, janelaSegundos, redis);
    } catch (e) {
      console.error("Falha ao consultar rate limit no Upstash, caiu pro limite em memória", e);
    }
  }
  return checarLimiteEmMemoria(chave, limite, janelaSegundos);
}

// IP do cliente a partir dos headers que a Vercel/proxy injeta. Sem nenhum
// deles (dev local), cai num valor fixo — ainda limita por não ter IP variando.
export function ipDaRequisicao(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "desconhecido";
}
