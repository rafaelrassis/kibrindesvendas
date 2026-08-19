import "server-only";
import { Resend } from "resend";

// Sem RESEND_API_KEY (dev local, ou loja que ainda não configurou) os
// e-mails só vão pro console — o site continua funcionando, do mesmo jeito
// que o pagamento cai pro modo simulado sem MERCADOPAGO_ACCESS_TOKEN.
function clienteConfigurado() {
  const chave = process.env.RESEND_API_KEY;
  return chave ? new Resend(chave) : null;
}

function remetente() {
  return process.env.EMAIL_FROM ?? "LeoKibrindes <onboarding@resend.dev>";
}

// Nunca deixa uma falha de e-mail derrubar o fluxo que a chamou (criar
// pedido, mudar status, pedir redefinição de senha) — e-mail é um "melhor
// esforço" depois que a ação principal já aconteceu ou foi validada.
async function enviar(destinatario: string, assunto: string, html: string) {
  const resend = clienteConfigurado();
  if (!resend) {
    console.log(`[email simulado] para ${destinatario}: ${assunto}`);
    return;
  }
  try {
    await resend.emails.send({ from: remetente(), to: destinatario, subject: assunto, html });
  } catch (e) {
    console.error("Falha ao enviar e-mail", e);
  }
}

function layout(titulo: string, corpo: string) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #3F6B4C;">${titulo}</h2>
      ${corpo}
      <p style="font-size: 12px; color: #888; margin-top: 32px;">LeoKibrindes — presentes personalizados</p>
    </div>
  `;
}

export async function enviarEmailStatusPedido(
  destinatario: string,
  nome: string,
  titulo: string,
  mensagem: string
) {
  await enviar(
    destinatario,
    titulo,
    layout(titulo, `<p>Olá, ${nome}!</p><p>${mensagem}</p>`)
  );
}

export async function enviarEmailRedefinirSenha(destinatario: string, nome: string, link: string) {
  await enviar(
    destinatario,
    "Redefinir sua senha — LeoKibrindes",
    layout(
      "Redefinir senha",
      `<p>Olá, ${nome}!</p>
       <p>Recebemos um pedido pra redefinir sua senha. Clique no link abaixo — ele vale por 1 hora:</p>
       <p><a href="${link}" style="color: #3F6B4C;">${link}</a></p>
       <p>Se você não pediu isso, pode ignorar este e-mail.</p>`
    )
  );
}
