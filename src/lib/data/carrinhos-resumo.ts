import "server-only";
import { baseUrl } from "@/lib/mercadopago";
import { enviarEmailResumoCarrinhos } from "@/lib/email";
import { getConfiguracaoLoja } from "./configuracao";
import { variacaoTexto } from "@/lib/variacao";
import { getPainelCarrinhos } from "./carrinhos-painel";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1).replace(".", ",")}%`);

// Resumo semanal por e-mail (cron de segunda). Vai pro mesmo endereço dos
// alertas da loja; sem endereço configurado, não envia nada.
export async function enviarResumoSemanalCarrinhos() {
  const { syncFornecedorEmailAlerta: destino } = await getConfiguracaoLoja();
  if (!destino) return { enviado: false as const, motivo: "sem e-mail de alerta" };

  // A semana anterior sai de 14 dias menos os últimos 7.
  const [p, p14] = await Promise.all([getPainelCarrinhos(7), getPainelCarrinhos(14)]);
  const ant = {
    enviados: p14.lembretes.enviados - p.lembretes.enviados,
    recuperados: p14.lembretes.recuperados - p.lembretes.recuperados,
    receita: p14.lembretes.receita - p.lembretes.receita,
    whatsReceita: p14.whatsapp.receita - p.whatsapp.receita,
  };
  const linhas = [
    `Lembretes enviados: ${p.lembretes.enviados} (${variacaoTexto(p.lembretes.enviados, ant.enviados)}) — recuperados: ${p.lembretes.recuperados} (${pct(p.lembretes.taxa)}; ${variacaoTexto(p.lembretes.recuperados, ant.recuperados)})`,
    `Receita recuperada por e-mail: ${reais(p.lembretes.receita)} (${variacaoTexto(p.lembretes.receita, ant.receita)})`,
    `WhatsApp: ${p.whatsapp.contatos} contato(s), ${p.whatsapp.recuperados} compra(s), ${reais(p.whatsapp.receita)} (${variacaoTexto(p.whatsapp.receita, ant.whatsReceita)})`,
    `Carrinhos parados agora: ${p.esquecidos.carrinhos} (${reais(p.esquecidos.valor)})`,
    ...(p.funilProdutos.length
      ? [
          `Muita visita, pouco carrinho: ${p.funilProdutos
            .slice(0, 3)
            .map((x) => `${x.nome} (${x.visitas} visitas, ${x.carrinho} no carrinho)`)
            .join("; ")}`,
        ]
      : []),
    ...(p.produtosParados.length
      ? [`Mais abandonados: ${p.produtosParados.map((x) => `${x.nome} (${x.carrinhos})`).join("; ")}`]
      : []),
    `Assunto 24h — ${p.lembretes.leituras.assunto24h.texto}`,
    `Assunto 72h — ${p.lembretes.leituras.assunto72h.texto}`,
    `Desconto — ${p.lembretes.leituras.desconto.texto}`,
    `Frase de destaque — ${p.lembretes.leituras.destaque.texto}`,
  ];
  await enviarEmailResumoCarrinhos(destino, linhas, `${baseUrl()}/admin/carrinhos`);
  return { enviado: true as const };
}
