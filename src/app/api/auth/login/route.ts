import { NextRequest, NextResponse } from "next/server";
import { autenticarUsuario } from "@/lib/data/usuarios";
import { criarSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { checarLimite, ipDaRequisicao } from "@/lib/rate-limit";

// 10 tentativas a cada 5 minutos por IP, e 5 por e-mail — o teto por e-mail é
// mais apertado porque é o alvo de um brute force de verdade; o teto por IP
// pega quem tenta vários e-mails diferentes na mesma origem.
const LIMITE_IP = 10;
const LIMITE_EMAIL = 5;
const JANELA_SEGUNDOS = 5 * 60;

export async function POST(req: NextRequest) {
  let email: string | undefined;
  let senha: string | undefined;
  try {
    ({ email, senha } = await corpoJson<{ email?: string; senha?: string }>(req));
  } catch (e) {
    return respostaDeErro(e);
  }

  if (!email?.trim() || !senha) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  const emailNormalizado = email.trim().toLowerCase();
  const ip = ipDaRequisicao(req.headers);

  const [porIp, porEmail] = await Promise.all([
    checarLimite(`login:ip:${ip}`, LIMITE_IP, JANELA_SEGUNDOS),
    checarLimite(`login:email:${emailNormalizado}`, LIMITE_EMAIL, JANELA_SEGUNDOS),
  ]);
  if (!porIp.permitido || !porEmail.permitido) {
    const espera = !porIp.permitido ? porIp.espereSegundos : (porEmail as { espereSegundos: number }).espereSegundos;
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
      { status: 429, headers: { "Retry-After": String(espera) } }
    );
  }

  const usuario = await autenticarUsuario(emailNormalizado, senha);
  if (!usuario) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  await criarSessao(usuario.id);
  return NextResponse.json(usuario);
}
