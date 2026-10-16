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
    // Os links do corpo também vão pro console: sem chave não há caixa de
    // entrada pra clicar, e o link de redefinição é justamente o único jeito
    // de seguir o fluxo — sem isto ele fica impossível de testar local.
    for (const [, url] of html.matchAll(/href="([^"]+)"/g)) {
      console.log(`  link: ${url}`);
    }
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: remetente(),
      to: destinatario,
      subject: assunto,
      html,
    });
    if (error) console.error("Falha ao enviar e-mail (Resend)", error);
  } catch (e) {
    console.error("Falha ao enviar e-mail", e);
  }
}

// O nome (e o nome do produto, e a variação escolhida) vêm do cadastro ou do
// catálogo, mas entram no HTML escapados de qualquer forma — defesa em
// profundidade contra fechar a tag e injetar marcação no e-mail.
function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moeda(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

// Mesmo formato "Chave: Valor · Chave: Valor" usado no resumo do checkout
// (ver CheckoutResumo.tsx), pra variação aparecer igual em todo lugar.
function resumoVariacao(variacao?: Record<string, string> | null) {
  if (!variacao) return "";
  return Object.entries(variacao)
    .map(([k, v]) => `${escaparHtml(k)}: ${escaparHtml(v)}`)
    .join(" · ");
}

// Mesma env var do botão flutuante do site (NEXT_PUBLIC_WHATSAPP_LOJA): só
// dígitos, com DDI. Sem ela o e-mail some com o bloco de contato em vez de
// linkar um wa.me quebrado.
function linkWhatsapp() {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;
  if (!numero) return null;
  const mensagem = "Olá! Vim do e-mail da LeoKibrindes e gostaria de tirar uma dúvida.";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

function layout(titulo: string, corpo: string) {
  const whatsapp = linkWhatsapp();
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #3F6B4C; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <span style="color: #fff; font-size: 18px; font-weight: 700;">LeoKibrindes</span>
      </div>
      <div style="border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <h2 style="color: #3F6B4C; margin-top: 0;">${titulo}</h2>
        ${corpo}
        ${
          whatsapp
            ? `<div style="margin-top: 24px; padding: 16px; background: #f4f7f5; border-radius: 8px; text-align: center;">
                 <p style="margin: 0 0 10px; font-size: 13px; color: #444;">Precisa falar com a gente?</p>
                 <a href="${whatsapp}" style="display: inline-block; background: #25D366; color: #fff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 999px;">Chamar no WhatsApp</a>
               </div>`
            : ""
        }
      </div>
      <p style="font-size: 12px; color: #888; margin-top: 20px; text-align: center;">
        LeoKibrindes — presentes personalizados<br/>
        Este é um e-mail automático — não responda a esta mensagem.
      </p>
    </div>
  `;
}

export type ItemPedidoEmail = {
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  variacao?: Record<string, string> | null;
};

export type ResumoPedidoEmail = {
  id: string;
  itens: ItemPedidoEmail[];
  frete: number;
  freteGratis: boolean;
  desconto: number;
  total: number;
};

function tabelaItens(pedido: ResumoPedidoEmail) {
  const linhasItens = pedido.itens
    .map((item) => {
      const variacao = resumoVariacao(item.variacao);
      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <span style="font-weight: 500;">${escaparHtml(item.nomeProduto)}</span>
            ${variacao ? `<br/><span style="font-size: 12px; color: #888;">${variacao}</span>` : ""}
            <br/><span style="font-size: 12px; color: #888;">Qtd: ${item.quantidade} × ${moeda(item.precoUnitario)}</span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">
            ${moeda(item.precoUnitario * item.quantidade)}
          </td>
        </tr>
      `;
    })
    .join("");

  const linhaFrete = pedido.freteGratis
    ? `<tr><td style="padding: 4px 0; color: #888;">Frete</td><td style="padding: 4px 0; text-align: right; color: #3F6B4C;">Grátis</td></tr>`
    : `<tr><td style="padding: 4px 0; color: #888;">Frete</td><td style="padding: 4px 0; text-align: right;">${moeda(pedido.frete)}</td></tr>`;
  const linhaDesconto =
    pedido.desconto > 0
      ? `<tr><td style="padding: 4px 0; color: #888;">Desconto</td><td style="padding: 4px 0; text-align: right; color: #3F6B4C;">-${moeda(pedido.desconto)}</td></tr>`
      : "";

  return `
    <p style="font-size: 13px; color: #888; margin-bottom: 4px;">Pedido #${escaparHtml(pedido.id.slice(0, 8))}</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
      ${linhasItens}
    </table>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      ${linhaFrete}
      ${linhaDesconto}
      <tr>
        <td style="padding: 8px 0 0; font-weight: 700; border-top: 1px solid #e5e5e5;">Total</td>
        <td style="padding: 8px 0 0; font-weight: 700; text-align: right; border-top: 1px solid #e5e5e5;">${moeda(pedido.total)}</td>
      </tr>
    </table>
  `;
}

export async function enviarEmailStatusPedido(
  destinatario: string,
  nome: string,
  titulo: string,
  mensagem: string,
  pedido?: ResumoPedidoEmail
) {
  const assunto = pedido ? `${titulo} — Pedido #${pedido.id.slice(0, 8)}` : titulo;
  await enviar(
    destinatario,
    assunto,
    layout(
      titulo,
      `<p>Olá, ${escaparHtml(nome)}!</p><p>${mensagem}</p>${pedido ? tabelaItens(pedido) : ""}`
    )
  );
}

export async function enviarEmailRedefinirSenha(destinatario: string, nome: string, link: string) {
  await enviar(
    destinatario,
    "Redefinir sua senha — LeoKibrindes",
    layout(
      "Redefinir senha",
      `<p>Olá, ${escaparHtml(nome)}!</p>
       <p>Recebemos um pedido pra redefinir sua senha. Clique no link abaixo — ele vale por 1 hora:</p>
       <p><a href="${link}" style="color: #3F6B4C;">${link}</a></p>
       <p>Se você não pediu isso, pode ignorar este e-mail.</p>`
    )
  );
}

// Alerta pro admin quando a sincronização com o fornecedor falha em algum
// produto (link quebrado, página mudou). Um e-mail por ciclo, com a lista.
export async function enviarEmailAlertaFornecedor(
  destinatario: string,
  falhas: { nome: string; url: string; erro: string }[]
) {
  const itens = falhas
    .map(
      (f) => `
        <li style="margin-bottom: 12px;">
          <strong>${escaparHtml(f.nome)}</strong><br/>
          <span style="color: #b42318;">${escaparHtml(f.erro)}</span><br/>
          <a href="${escaparHtml(f.url)}" style="color: #3F6B4C; font-size: 12px;">${escaparHtml(f.url)}</a>
        </li>`
    )
    .join("");
  await enviar(
    destinatario,
    `⚠️ Sincronização com fornecedor falhou em ${falhas.length} produto(s)`,
    layout(
      "Falha na sincronização com o fornecedor",
      `<p>O estoque destes produtos <strong>não foi atualizado</strong> — confira o link no cadastro:</p>
       <ul style="padding-left: 18px;">${itens}</ul>`
    )
  );
}

function listaItensEmail(itens: { nome: string; quantidade: number }[]) {
  const lista = itens
    .map(
      (i) =>
        `<li style="margin-bottom: 6px;">${escaparHtml(i.nome)}${i.quantidade > 1 ? ` (${i.quantidade}x)` : ""}</li>`
    )
    .join("");
  return `<ul style="padding-left: 18px;">${lista}</ul>`;
}

function botaoEmail(texto: string, link: string) {
  return `<p style="text-align: center; margin-top: 20px;">
    <a href="${link}" style="display: inline-block; background: #3F6B4C; color: #fff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 999px;">${texto}</a>
  </p>`;
}

// Lembrete de carrinho esquecido (ver enviarLembretesCarrinho). Só nomes e
// quantidades: preço e estoque mudam, e o link leva o cliente pro carrinho
// com os valores de hoje. Com `cupom`, é o segundo lembrete, com o desconto.
export async function enviarEmailCarrinhoEsquecido(
  destinatario: string,
  nome: string,
  itens: { nome: string; quantidade: number }[],
  link: string,
  assunto: string,
  cupom?: { codigo: string; percentual: number; validoAte: Date }
) {
  const validade = cupom?.validoAte.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await enviar(
    destinatario,
    assunto,
    layout(
      cupom ? `${cupom.percentual}% de desconto só pra você` : "Seus itens ainda estão te esperando",
      `<p>Olá, ${escaparHtml(nome)}!</p>
       <p>Você deixou isto no carrinho:</p>
       ${listaItensEmail(itens)}
       ${
         cupom
           ? `<div style="margin: 16px 0; padding: 16px; background: #f4f7f5; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 6px; font-size: 13px; color: #444;">Use o cupom no checkout (vale 1 vez, até ${validade}):</p>
                <p style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 2px; color: #3F6B4C;">${escaparHtml(cupom.codigo)}</p>
              </div>`
           : ""
       }
       ${botaoEmail("Voltar ao carrinho", link)}`
    )
  );
}

// Lembrete pra visitante (sem conta) que deixou o e-mail no carrinho. O link de
// recuperação devolve os itens ao navegador; o de cancelar apaga o registro.
export async function enviarEmailCarrinhoVisitante(
  destinatario: string,
  itens: { nome: string; quantidade: number }[],
  linkRecuperar: string,
  linkCancelar: string
) {
  await enviar(
    destinatario,
    "Seu carrinho está te esperando — LeoKibrindes",
    layout(
      "Seus itens ainda estão te esperando",
      `<p>Olá!</p>
       <p>Você pediu pra guardarmos seu carrinho:</p>
       ${listaItensEmail(itens)}
       ${botaoEmail("Recuperar meu carrinho", linkRecuperar)}
       <p style="font-size: 12px; color: #888; text-align: center;">
         Não quer mais receber isso? <a href="${linkCancelar}" style="color: #888;">Apagar meu carrinho e e-mail</a>
       </p>`
    )
  );
}

// Aviso pra quem favoritou um produto que estava esgotado e voltou ao estoque.
export async function enviarEmailVoltouAoEstoque(
  destinatario: string,
  nome: string,
  produto: string,
  link: string
) {
  await enviar(
    destinatario,
    `${produto} voltou ao estoque — LeoKibrindes`,
    layout(
      "Voltou ao estoque!",
      `<p>Olá, ${escaparHtml(nome)}!</p>
       <p><strong>${escaparHtml(produto)}</strong>, que está nos seus favoritos, voltou a ficar disponível. As unidades costumam acabar rápido.</p>
       ${botaoEmail("Ver produto", link)}`
    )
  );
}

// Aviso ao admin: um teste A/B do carrinho chegou a resultado significativo.
export async function enviarEmailResultadoAB(destinatario: string, linhas: string[], link: string) {
  await enviar(
    destinatario,
    "Teste A/B do carrinho tem resultado — LeoKibrindes",
    layout(
      "Teste A/B com resultado",
      `<p>Estes testes já têm diferença significativa (95%):</p>
       <ul>${linhas.map((l) => `<li>${escaparHtml(l)}</li>`).join("")}</ul>
       <p>Trave a variante vencedora em Configurações para todos receberem a melhor.</p>
       ${botaoEmail("Ver painel", link)}`
    )
  );
}
