import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gerarTokenRedefinicao, usuarioIdDoTokenRedefinicao } from "@/lib/session";
import { enviarEmailRedefinirSenha } from "@/lib/email";
import { baseUrl } from "@/lib/mercadopago";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { checarLimite, ipDaRequisicao } from "@/lib/rate-limit";
import { redefinirSenhaComToken } from "@/lib/data/usuarios";

const LIMITE = 5;
const JANELA_SEGUNDOS = 15 * 60;

// Sempre responde 200 com a mesma mensagem, exista ou não o e-mail — não dá
// pra deixar essa rota confirmar pra quem está testando quais e-mails têm
// conta na loja.
export async function POST(req: NextRequest) {
  let email: string | undefined;
  try {
    ({ email } = await corpoJson<{ email?: string }>(req));
  } catch (e) {
    return respostaDeErro(e);
  }

  if (!email?.trim()) {
    return NextResponse.json({ error: "Informe seu e-mail." }, { status: 400 });
  }

  const ip = ipDaRequisicao(req.headers);
  const limite = await checarLimite(`recuperar:${ip}`, LIMITE, JANELA_SEGUNDOS);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
      { status: 429, headers: { "Retry-After": String(limite.espereSegundos) } }
    );
  }

  const emailNormalizado = email.trim().toLowerCase();
  const usuario = await prisma.usuario.findUnique({ where: { email: emailNormalizado } });

  if (usuario) {
    const token = gerarTokenRedefinicao(usuario.id, usuario.senhaHash);
    const link = `${baseUrl()}/redefinir-senha?token=${token}`;
    enviarEmailRedefinirSenha(usuario.email, usuario.nome, link).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    mensagem: "Se este e-mail tiver uma conta, enviamos um link de redefinição.",
  });
}

export async function PATCH(req: NextRequest) {
  let token: string | undefined;
  let novaSenha: string | undefined;
  try {
    ({ token, novaSenha } = await corpoJson<{ token?: string; novaSenha?: string }>(req));
  } catch (e) {
    return respostaDeErro(e);
  }

  if (!token || !novaSenha || novaSenha.length < 6) {
    return NextResponse.json(
      { error: "Preencha uma nova senha com pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  // O hash atual entra na conferência da assinatura: link já usado (ou emitido
  // antes de uma troca de senha por outro caminho) não fecha mais.
  const usuarioId = await usuarioIdDoTokenRedefinicao(token, async (id) => {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { senhaHash: true },
    });
    return usuario?.senhaHash ?? null;
  });
  if (!usuarioId) {
    return NextResponse.json(
      { error: "Link inválido ou expirado. Peça uma nova redefinição." },
      { status: 400 }
    );
  }

  try {
    await redefinirSenhaComToken(usuarioId, novaSenha);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível redefinir a senha." },
      { status: 400 }
    );
  }
}
