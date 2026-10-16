import "server-only";
import { baseUrl } from "@/lib/mercadopago";
import { enviarEmailResumoCarrinhos } from "@/lib/email";
import { getConfiguracaoLoja } from "./configuracao";
import { getPainelCarrinhos } from "./carrinhos-painel";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1).replace(".", ",")}%`);

// Resumo semanal por e-mail (cron de segunda). Vai pro mesmo endereço dos
// alertas da loja; sem endereço configurado, não envia nada.
export async function enviarResumoSemanalCarrinhos() {
  const { syncFornecedorEmailAlerta: destino } = await getConfiguracaoLoja();
  if (!destino) return { enviado: false as const, motivo: "sem e-mail de alerta" };

  const p = await getPainelCarrinhos(7);
  const linhas = [
    `Lembretes enviados: ${p.lembretes.enviados} — recuperados: ${p.lembretes.recuperados} (${pct(p.lembretes.taxa)})`,
    `Receita recuperada por e-mail: ${reais(p.lembretes.receita)}`,
    `WhatsApp: ${p.whatsapp.contatos} contato(s), ${p.whatsapp.recuperados} compra(s), ${reais(p.whatsapp.receita)}`,
    `Carrinhos parados agora: ${p.esquecidos.carrinhos} (${reais(p.esquecidos.valor)})`,
    `Assunto 24h — ${p.lembretes.leituras.assunto24h.texto}`,
    `Assunto 72h — ${p.lembretes.leituras.assunto72h.texto}`,
    `Desconto — ${p.lembretes.leituras.desconto.texto}`,
  ];
  await enviarEmailResumoCarrinhos(destino, linhas, `${baseUrl()}/admin/carrinhos`);
  return { enviado: true as const };
}
