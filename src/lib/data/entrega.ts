import "server-only";
import { calcularFrete, cotarFreteMelhorEnvio, normalizarCep, type Frete } from "@/lib/frete";
import { prisma } from "@/lib/prisma";
import { ErroDeNegocio } from "./erros";

export type EnderecoDeEntrega = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  frete: Frete;
};

// O ViaCEP é público e sem credencial, mas é serviço de terceiro: cai, tem
// latência e às vezes devolve HTML. Timeout curto e erro traduzido pro cliente.
const TIMEOUT_MS = 5000;

type RespostaViaCep = {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

// Cotação real (Correios via Melhor Envio) quando há produto e token
// configurado; cai pra estimativa por região quando falta um dos dois ou a
// API do agregador não responde. Nunca deixa o cliente sem número de frete.
async function calcularFreteReal(
  uf: string,
  cepDestino: string,
  produtoId?: string,
  quantidade = 1
): Promise<Frete> {
  const estimativa = calcularFrete(uf);
  if (!produtoId) return estimativa;

  const [config, produto] = await Promise.all([
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } }),
    prisma.produto.findUnique({
      where: { id: produtoId },
      select: { pesoGramas: true, alturaCm: true, larguraCm: true, comprimentoCm: true },
    }),
  ]);

  if (!config?.melhorEnvioToken || !produto) return estimativa;

  const cotacao = await cotarFreteMelhorEnvio(
    config.melhorEnvioToken,
    normalizarCep(config.cepOrigem) ?? config.cepOrigem,
    cepDestino,
    produto,
    quantidade
  );

  return cotacao ?? estimativa;
}

// Fonte da verdade do endereço e do frete: a tela do checkout consulta pra
// mostrar o valor, e o pedido consulta de novo na hora de gravar, pra não
// confiar no número que voltou do navegador.
// `cepBruto` é `unknown` porque chega do corpo da requisição: pedido sem CEP
// nenhum tem que virar 400, não 500 num `.replace` de undefined.
// `produtoIdBruto` é opcional — sem ele (ex: cadastro de endereço avulso)
// cai direto na estimativa por região.
export async function consultarCep(
  cepBruto: unknown,
  produtoIdBruto?: unknown,
  quantidadeBruta?: unknown
): Promise<EnderecoDeEntrega> {
  const cep = typeof cepBruto === "string" ? normalizarCep(cepBruto) : null;
  if (!cep) throw new ErroDeNegocio("CEP inválido: informe os 8 dígitos.");
  const produtoId = typeof produtoIdBruto === "string" ? produtoIdBruto : undefined;
  const quantidadeNum = Number(quantidadeBruta);
  const quantidade =
    Number.isFinite(quantidadeNum) && quantidadeNum > 0 ? Math.round(quantidadeNum) : 1;

  let resposta: Response;
  try {
    resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // O CEP muda muito pouco; cachear evita bater no ViaCEP a cada tecla.
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch {
    throw new ErroDeNegocio("Não foi possível consultar o CEP agora. Tente de novo.", 502);
  }

  if (!resposta.ok) {
    throw new ErroDeNegocio("Não foi possível consultar o CEP agora. Tente de novo.", 502);
  }

  const dados = (await resposta.json().catch(() => null)) as RespostaViaCep | null;

  // CEP inexistente volta 200 com `{ "erro": true }` — não dá pra olhar só o status.
  if (!dados || dados.erro || !dados.uf) {
    throw new ErroDeNegocio("CEP não encontrado.", 404);
  }

  return {
    cep,
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    uf: dados.uf,
    frete: await calcularFreteReal(dados.uf, cep, produtoId, quantidade),
  };
}

// Uma linha só, do jeito que o cliente e a loja leem depois no pedido.
export function resumoDoEndereco(endereco: EnderecoDeEntrega) {
  const rua = [endereco.logradouro, endereco.bairro].filter(Boolean).join(", ");
  return [rua, `${endereco.cidade}/${endereco.uf}`].filter(Boolean).join(" — ");
}
