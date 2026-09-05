import "server-only";
import { TransportadoraFrete } from "@prisma/client";
import {
  calcularFrete,
  cotarFreteMelhorEnvio,
  cotarFreteSuperFrete,
  normalizarCep,
  type OpcaoFrete,
} from "@/lib/frete";
import { prisma } from "@/lib/prisma";
import { dimensaoEfetiva } from "@/lib/estoque-variacao";
import type { DimensaoValor } from "@/lib/types";
import { ErroDeNegocio } from "./erros";

export type EnderecoDeEntrega = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  // Todas as opções cotadas (mais de uma só quando a transportadora ativa
  // devolve várias, ex: SuperFrete com PAC e SEDEX). Ordenado do mais barato
  // pro mais caro.
  opcoesFrete: OpcaoFrete[];
  // A opção usada de fato no cálculo do total — a mais barata por padrão, ou
  // a que o cliente escolheu (ver `servicoEscolhido` em consultarCep).
  frete: OpcaoFrete;
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

// Cotação real (Correios, via Melhor Envio ou SuperFrete — o que estiver
// ativo em /admin/configuracoes) quando há produto e token configurado; cai
// pra estimativa por região quando falta um dos dois ou a API do agregador
// não responde. Nunca deixa o cliente sem número de frete.
async function cotarOpcoesFrete(
  uf: string,
  cepDestino: string,
  produtoId?: string,
  quantidade = 1,
  variacoesEscolhidas?: Record<string, string>
): Promise<OpcaoFrete[]> {
  const estimativa: OpcaoFrete[] = [{ ...calcularFrete(uf), servico: "Estimativa" }];
  if (!produtoId) return estimativa;

  const [config, produtoDb] = await Promise.all([
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } }),
    prisma.produto.findUnique({
      where: { id: produtoId },
      select: {
        pesoMiligramas: true,
        alturaMm: true,
        larguraMm: true,
        comprimentoMm: true,
        cepOrigemOverride: true,
        variacoes: { select: { tipo: true, dimensoesValores: true } },
      },
    }),
  ]);

  if (!config || !produtoDb) return estimativa;

  // Variação escolhida (ex: tamanho de ímã) pode ter peso/dimensão próprios,
  // que substituem os do produto campo a campo — ver dimensaoEfetiva.
  const produto = dimensaoEfetiva(
    {
      ...produtoDb,
      variacoes: produtoDb.variacoes.map((v) => ({
        tipo: v.tipo,
        dimensoesValores: v.dimensoesValores as Record<string, DimensaoValor> | null,
      })),
    },
    variacoesEscolhidas ?? {}
  );

  // Produto com fornecedor próprio (ex: camiseta despachada de Franca-SP)
  // cota a partir do CEP dele; os demais caem no CEP padrão da loja.
  const cepOrigemBruto = produto.cepOrigemOverride ?? config.cepOrigem;
  const cepOrigem = normalizarCep(cepOrigemBruto) ?? cepOrigemBruto;

  if (config.transportadoraAtiva === TransportadoraFrete.SUPER_FRETE) {
    if (!config.superFreteToken) return estimativa;
    const opcoes = await cotarFreteSuperFrete(
      config.superFreteToken,
      cepOrigem,
      cepDestino,
      produto,
      quantidade,
      config.freteAchataFaixaPeso
    );
    return opcoes && opcoes.length > 0 ? opcoes : estimativa;
  }

  // MELHOR_ENVIO — mantém o comportamento de sempre: só a mais barata.
  if (!config.melhorEnvioToken) return estimativa;
  const cotacao = await cotarFreteMelhorEnvio(
    config.melhorEnvioToken,
    cepOrigem,
    cepDestino,
    produto,
    quantidade
  );
  return cotacao ? [{ ...cotacao, servico: "Correios" }] : estimativa;
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
  quantidadeBruta?: unknown,
  servicoEscolhidoBruto?: unknown,
  variacoesEscolhidasBruta?: unknown
): Promise<EnderecoDeEntrega> {
  const cep = typeof cepBruto === "string" ? normalizarCep(cepBruto) : null;
  if (!cep) throw new ErroDeNegocio("CEP inválido: informe os 8 dígitos.");
  const produtoId = typeof produtoIdBruto === "string" ? produtoIdBruto : undefined;
  const quantidadeNum = Number(quantidadeBruta);
  const quantidade =
    Number.isFinite(quantidadeNum) && quantidadeNum > 0 ? Math.round(quantidadeNum) : 1;
  const servicoEscolhido =
    typeof servicoEscolhidoBruto === "string" ? servicoEscolhidoBruto : undefined;
  // Vem serializado em JSON na querystring (ex: {"Tamanho":"7x5"}) — corpo
  // malformado ou ausente cai em "sem variação", igual produto sem grade.
  let variacoesEscolhidas: Record<string, string> | undefined;
  if (typeof variacoesEscolhidasBruta === "string" && variacoesEscolhidasBruta) {
    try {
      const parsed = JSON.parse(variacoesEscolhidasBruta);
      if (parsed && typeof parsed === "object") variacoesEscolhidas = parsed;
    } catch {
      // ignora e segue sem override de dimensão
    }
  } else if (variacoesEscolhidasBruta && typeof variacoesEscolhidasBruta === "object") {
    variacoesEscolhidas = variacoesEscolhidasBruta as Record<string, string>;
  }

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

  const opcoesFrete = await cotarOpcoesFrete(
    dados.uf,
    cep,
    produtoId,
    quantidade,
    variacoesEscolhidas
  );
  // Serviço escolhido pelo cliente no checkout (ex: "SEDEX"), se existir e
  // continuar entre as opções cotadas agora; senão, a mais barata (primeira
  // da lista, já vem ordenada).
  const frete =
    opcoesFrete.find((o) => o.servico === servicoEscolhido) ?? opcoesFrete[0];

  return {
    cep,
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    uf: dados.uf,
    opcoesFrete,
    frete,
  };
}

// Uma linha só, do jeito que o cliente e a loja leem depois no pedido.
export function resumoDoEndereco(endereco: EnderecoDeEntrega) {
  const rua = [endereco.logradouro, endereco.bairro].filter(Boolean).join(", ");
  return [rua, `${endereco.cidade}/${endereco.uf}`].filter(Boolean).join(" — ");
}

// Endereço salvo (ver model Endereco) + cotação de frete a partir dele — é o
// que o checkout usa depois que o cliente escolhe (ou cadastra) um endereço,
// em vez de digitar um CEP solto sem número nem destinatário.
export type EnderecoDeEntregaSalvo = EnderecoDeEntrega & {
  destinatario: string;
  numero: string;
  complemento: string;
  rua: string;
};

// Confia só no `enderecoId` + dono da sessão: nunca no CEP/número que o
// navegador tenha mandado solto, senão qualquer usuário logado poderia
// cotar (ou pior, gravar num pedido) o endereço de outra pessoa.
export async function consultarEnderecoSalvo(
  usuarioId: string,
  enderecoIdBruto: unknown,
  produtoIdBruto?: unknown,
  quantidadeBruta?: unknown,
  servicoEscolhidoBruto?: unknown,
  variacoesEscolhidasBruta?: unknown
): Promise<EnderecoDeEntregaSalvo> {
  const enderecoId = typeof enderecoIdBruto === "string" ? enderecoIdBruto : null;
  if (!enderecoId) throw new ErroDeNegocio("Escolha um endereço de entrega.");

  const salvo = await prisma.endereco.findFirst({ where: { id: enderecoId, usuarioId } });
  if (!salvo) throw new ErroDeNegocio("Endereço não encontrado.", 404);

  const cotacao = await consultarCep(
    salvo.cep,
    produtoIdBruto,
    quantidadeBruta,
    servicoEscolhidoBruto,
    variacoesEscolhidasBruta
  );

  return {
    ...cotacao,
    destinatario: salvo.destinatario,
    numero: salvo.numero,
    complemento: salvo.complemento ?? "",
    rua: salvo.rua,
  };
}

// Resumo completo pro pedido — a diferença do `resumoDoEndereco` de cima é
// que este vem do Endereco salvo (tem número e destinatário), não só do
// ViaCEP.
export function resumoDoEnderecoSalvo(endereco: EnderecoDeEntregaSalvo) {
  const rua = [`${endereco.rua}, ${endereco.numero}`, endereco.complemento, endereco.bairro]
    .filter(Boolean)
    .join(", ");
  return [rua, `${endereco.cidade}/${endereco.uf}`].filter(Boolean).join(" — ");
}
