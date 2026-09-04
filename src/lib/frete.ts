// Estimativa por região, não é cotação de transportadora. Quando houver
// contrato (Correios, Melhor Envio), só esta função muda: quem chama já
// trabalha com `uf -> { valor, prazoDias }`.

export type Frete = { valor: number; prazoDias: number };

type Regiao = "SP" | "SUDESTE" | "SUL_CO" | "NORDESTE" | "NORTE";

const REGIAO_POR_UF: Record<string, Regiao> = {
  SP: "SP",
  RJ: "SUDESTE",
  MG: "SUDESTE",
  ES: "SUDESTE",
  PR: "SUL_CO",
  SC: "SUL_CO",
  RS: "SUL_CO",
  MS: "SUL_CO",
  MT: "SUL_CO",
  GO: "SUL_CO",
  DF: "SUL_CO",
  BA: "NORDESTE",
  SE: "NORDESTE",
  AL: "NORDESTE",
  PE: "NORDESTE",
  PB: "NORDESTE",
  RN: "NORDESTE",
  CE: "NORDESTE",
  PI: "NORDESTE",
  MA: "NORDESTE",
  PA: "NORTE",
  AP: "NORTE",
  AM: "NORTE",
  RR: "NORTE",
  RO: "NORTE",
  AC: "NORTE",
  TO: "NORTE",
};

const TABELA: Record<Regiao, Frete> = {
  SP: { valor: 9.9, prazoDias: 2 },
  SUDESTE: { valor: 16.9, prazoDias: 4 },
  SUL_CO: { valor: 22.9, prazoDias: 6 },
  NORDESTE: { valor: 29.9, prazoDias: 8 },
  NORTE: { valor: 36.9, prazoDias: 10 },
};

// A loja despacha de São Paulo, então UF desconhecida cai na faixa mais cara
// em vez de sair de graça.
const PADRAO: Frete = TABELA.NORTE;

// Nome mantido por compatibilidade com quem já importa `calcularFrete`;
// por baixo dos panos é a estimativa por região, usada como fallback quando
// a cotação real (Melhor Envio) não está configurada ou falha.
export function calcularFrete(uf: string): Frete {
  return TABELA[REGIAO_POR_UF[uf.trim().toUpperCase()]] ?? PADRAO;
}

// --- Cotação real via Melhor Envio (agregador dos Correios) ---------------
// A loja envia por Correios; em vez de integrar direto com o SIGEP Web
// (exige contrato e é SOAP/XML), cotamos pelo Melhor Envio: API REST simples,
// sem contrato prévio, e que já devolve PAC/SEDEX com prazo e preço reais.

// Dimensões de 1 unidade, em milímetros. `alturaMm` é a única que empilha
// com a quantidade (ver cotarFreteSuperFrete); as APIs de frete trabalham em
// cm, então convertemos (mm / 10) na hora de montar o payload.
export type PacoteFrete = {
  pesoMiligramas: number;
  alturaMm: number;
  larguraMm: number;
  comprimentoMm: number;
};

// Uma opção cotada de um serviço específico (ex: PAC, SEDEX). O Melhor
// Envio devolve só a mais barata embrulhada nisso (lista de 1); o SuperFrete
// devolve todas, pra o cliente escolher no checkout.
export type OpcaoFrete = Frete & { servico: string };

type ServicoMelhorEnvio = {
  id: number;
  name: string;
  price: string;
  delivery_time: number;
  company: { name: string };
  error?: string;
};

// Dimensão mínima aceita pelos Correios é 16x11x2cm — pacote menor que isso
// é rejeitado pela cotação, então arredondamos pra cima antes de enviar.
const MIN_ALTURA_CM = 2;
const MIN_LARGURA_CM = 11;
const MIN_COMPRIMENTO_CM = 16;

// `quantidade` é o número de unidades do produto no pedido — o Melhor Envio
// soma o peso de todas as unidades no `quantity` do produto em vez de a
// gente multiplicar `weight` na mão (dimensões da caixa não multiplicam,
// só o peso total embarcado).
export async function cotarFreteMelhorEnvio(
  token: string,
  cepOrigem: string,
  cepDestino: string,
  pacote: PacoteFrete,
  quantidade = 1
): Promise<Frete | null> {
  const body = {
    from: { postal_code: cepOrigem },
    to: { postal_code: cepDestino },
    products: [
      {
        id: "1",
        width: Math.max(pacote.larguraMm / 10, MIN_LARGURA_CM),
        height: Math.max(pacote.alturaMm / 10, MIN_ALTURA_CM),
        length: Math.max(pacote.comprimentoMm / 10, MIN_COMPRIMENTO_CM),
        weight: Math.max(pacote.pesoMiligramas, 1) / 1_000_000,
        insurance_value: 0,
        quantity: Math.max(1, Math.round(quantidade) || 1),
      },
    ],
  };

  let resposta: Response;
  try {
    resposta = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        // Exigido pelo Melhor Envio pra identificar quem consome a API.
        "User-Agent": "LeoKibrindes (contato@leokibrindes.com.br)",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[frete] Melhor Envio: falha de rede", e);
    return null;
  }

  const corpoBruto = typeof resposta.text === "function" ? await resposta.text().catch(() => "") : "";

  if (!resposta.ok) {
    console.error("[frete] Melhor Envio: resposta não-ok", resposta.status, corpoBruto);
    return null;
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    console.error("[frete] Melhor Envio: resposta não é JSON válido", corpoBruto);
    return null;
  }

  const servicos = corpo as ServicoMelhorEnvio[] | null;
  if (!Array.isArray(servicos)) {
    console.error("[frete] Melhor Envio: resposta não é um array", corpo);
    return null;
  }

  // Descarta opções com erro (ex: transportadora não atende a rota) e fica
  // com a mais barata entre as que sobraram — normalmente o PAC.
  const validos = servicos.filter((s) => !s.error && s.price);
  if (validos.length === 0) {
    console.error("[frete] Melhor Envio: nenhuma opção válida", servicos);
    return null;
  }

  const maisBarato = validos.reduce((menor, s) =>
    Number(s.price) < Number(menor.price) ? s : menor
  );

  return {
    valor: Number(maisBarato.price),
    prazoDias: maisBarato.delivery_time,
  };
}

// --- Cotação real via SuperFrete (agregador de transportadoras, alternativa
// ao Melhor Envio) ----------------------------------------------------------
// Endpoint e formato conferidos na doc oficial (superfrete.readme.io/reference/
// cotacao-de-frete) — a API v0 do SuperFrete NÃO segue o mesmo contrato do
// Melhor Envio: endpoint próprio, `insurance_value` no nível de `options` (não
// dentro de cada produto), exige `services` (ids separados por vírgula) e cada
// opção reporta erro em `has_error`, não em `error`.
//
// "1"/"2" são PAC/SEDEX (Correios) e "31" é a Loggi — as transportadoras que
// a loja despacha de fato.
const SERVICOS_DESPACHADOS = "1,2,31";

type ServicoSuperFrete = {
  id: number;
  name: string;
  price: number;
  delivery_time: number;
  company: { name: string };
  has_error?: boolean;
};

// Não existe um limite fixo confiável: os Correios rejeitam qualquer caixa
// acima de 150cm de altura, mas na prática algumas rotas (o CEP de coleta,
// não o produto) rejeitam bem antes disso — testado direto na API, uma
// caixa de ~104cm já esbarra no limite de "peso ou medidas" de uma rota
// específica, enquanto a mesma caixa sai de outra rota numa boa. Por isso,
// em vez de adivinhar um teto, cotarComRecuo tenta a caixa inteira e, se a
// API rejeitar (por altura, peso ou qualquer combinação), divide ao meio e
// tenta de novo recursivamente — cada rota encontra seu próprio limite.
//
// `chamadasRestantes` é um teto de segurança (mutável, compartilhado entre
// as chamadas recursivas) pra nunca fazer mais que um punhado de tentativas
// numa rota totalmente inviável (CEP que não recebe entrega nenhuma, por
// exemplo) — sem isso, um pedido de milhares de unidades poderia dividir até
// 1 em 1 e estourar o tempo da função.
const MAX_TENTATIVAS_SUPERFRETE = 24;

async function cotarComRecuo(
  token: string,
  cepOrigem: string,
  cepDestino: string,
  pacote: PacoteFrete,
  unidadesNaCaixa: number,
  chamadasRestantes: { valor: number },
  achatarFaixaPeso: boolean
): Promise<{ tamanho: number; servicos: ServicoSuperFrete[] }[] | null> {
  if (chamadasRestantes.valor <= 0) return null;
  chamadasRestantes.valor -= 1;

  const servicos = await cotarCaixaSuperFrete(
    token,
    cepOrigem,
    cepDestino,
    pacote,
    unidadesNaCaixa,
    achatarFaixaPeso
  );
  if (servicos) return [{ tamanho: unidadesNaCaixa, servicos }];
  if (unidadesNaCaixa <= 1) return null;

  const metade1 = Math.ceil(unidadesNaCaixa / 2);
  const metade2 = unidadesNaCaixa - metade1;
  const [r1, r2] = await Promise.all([
    cotarComRecuo(token, cepOrigem, cepDestino, pacote, metade1, chamadasRestantes, achatarFaixaPeso),
    cotarComRecuo(token, cepOrigem, cepDestino, pacote, metade2, chamadasRestantes, achatarFaixaPeso),
  ]);
  if (!r1 || !r2) return null;
  return [...r1, ...r2];
}

// Os Correios cobram por faixa de peso na etiqueta de verdade (até 300g e
// depois de 1 em 1kg — é o que aparece no seletor "Digitar peso" do site da
// SuperFrete). A API de cotação, porém, devolve preço contínuo. Quando
// `freteAchataFaixaPeso` está ligado em /admin/configuracoes, arredondamos o
// peso da caixa pro teto da própria faixa antes de cotar — isso acha a
// mesma cotação pra qualquer quantidade dentro da faixa (66, 90, 200 ou 222
// unidades pesando entre 300g e 1kg cotam igual). Desligado, cota pelo peso
// real contínuo.
function tetoDaFaixaMg(pesoMg: number): number {
  const pesoG = pesoMg / 1000;
  const tetoG = pesoG <= 300 ? 300 : Math.ceil(pesoG / 1000) * 1000;
  return tetoG * 1000;
}

// Cota uma única caixa com `unidadesNaCaixa` empilhadas. Devolve as opções
// cruas da API (sem converter pra OpcaoFrete) porque cotarFreteSuperFrete
// ainda precisa somar os preços das várias caixas de um mesmo pedido.
async function cotarCaixaSuperFrete(
  token: string,
  cepOrigem: string,
  cepDestino: string,
  pacote: PacoteFrete,
  unidadesNaCaixa: number,
  achatarFaixaPeso: boolean
): Promise<ServicoSuperFrete[] | null> {
  const pesoRealMg = Math.max(pacote.pesoMiligramas, 1) * unidadesNaCaixa;
  const pesoCobradoMg = achatarFaixaPeso ? tetoDaFaixaMg(pesoRealMg) : pesoRealMg;
  // A altura sobe na mesma proporção que o peso: senão a cubagem (calculada
  // a partir da altura real, que continua variando unidade a unidade)
  // furaria o achatamento por faixa que acabamos de fazer no peso.
  const fatorFaixa = pesoCobradoMg / pesoRealMg;

  const body = {
    from: { postal_code: cepOrigem },
    to: { postal_code: cepDestino },
    services: SERVICOS_DESPACHADOS,
    options: { insurance_value: 0, use_insurance_value: false, own_hand: false, receipt: false },
    products: [
      {
        width: Math.max(pacote.larguraMm / 10, MIN_LARGURA_CM),
        height: Math.max((pacote.alturaMm * unidadesNaCaixa * fatorFaixa) / 10, MIN_ALTURA_CM),
        length: Math.max(pacote.comprimentoMm / 10, MIN_COMPRIMENTO_CM),
        weight: pesoCobradoMg / 1_000_000,
        quantity: 1,
      },
    ],
  };

  let resposta: Response;
  try {
    resposta = await fetch("https://api.superfrete.com/api/v0/calculator", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "LeoKibrindes (contato@leokibrindes.com.br)",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[frete] SuperFrete: falha de rede", e);
    return null;
  }

  const corpoBruto = typeof resposta.text === "function" ? await resposta.text().catch(() => "") : "";

  if (!resposta.ok) {
    console.error("[frete] SuperFrete: resposta não-ok", resposta.status, corpoBruto);
    return null;
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    console.error("[frete] SuperFrete: resposta não é JSON válido", corpoBruto);
    return null;
  }

  const servicos = corpo as ServicoSuperFrete[] | null;
  if (!Array.isArray(servicos)) {
    console.error("[frete] SuperFrete: resposta não é um array", corpo);
    return null;
  }

  const validos = servicos.filter((s) => !s.has_error && s.price);
  if (validos.length === 0) {
    console.error("[frete] SuperFrete: nenhuma opção válida", servicos);
    return null;
  }

  return validos;
}

// Ao contrário do cotarFreteMelhorEnvio (que fica só com a mais barata), esta
// função devolve todas as opções válidas, pra o cliente escolher no checkout.
//
// Diferente do Melhor Envio, o `quantity` da calculadora v0 do SuperFrete não
// serve só pra somar peso: pra alguns serviços (ex: Mini Envios) ele entra na
// cubagem só quando "sobra" acima de um certo limite, aí o SuperFrete decide
// sozinho um novo formato de caixa (confirmado com o suporte: viramos um
// cubo de 27x27x27cm do nada com `quantity: 25`, em vez de simplesmente
// empilhar). Por isso sempre mandamos `quantity: 1` e fazemos a cubagem nós
// mesmos: a pilha de `unidades` cresce em altura (a base largura x comprimento
// do produto não muda), e o peso é o total embarcado.
//
// Quando a caixa inteira é rejeitada pela rota (altura, peso, ou qualquer
// combinação — o limite real varia por CEP de coleta, não só pelo tamanho do
// produto), cotarComRecuo divide o pedido em caixas menores até cada uma
// caber; o preço final é a soma das caixas pro mesmo serviço. Um serviço só
// entra no resultado se TODAS as caixas conseguiram cotar nele — não faz
// sentido despachar metade do pedido por um serviço e a outra metade por outro.
export async function cotarFreteSuperFrete(
  token: string,
  cepOrigem: string,
  cepDestino: string,
  pacote: PacoteFrete,
  quantidade = 1,
  achatarFaixaPeso = true
): Promise<OpcaoFrete[] | null> {
  const unidades = Math.max(1, Math.round(quantidade) || 1);
  const caixas = await cotarComRecuo(
    token,
    cepOrigem,
    cepDestino,
    pacote,
    unidades,
    { valor: MAX_TENTATIVAS_SUPERFRETE },
    achatarFaixaPeso
  );
  if (!caixas) return null;

  const porServico = new Map<string, { valor: number; prazoDias: number; caixasCotadas: number }>();
  for (const { servicos } of caixas) {
    for (const s of servicos) {
      const atual = porServico.get(s.name);
      if (atual) {
        atual.valor += Number(s.price);
        atual.prazoDias = Math.max(atual.prazoDias, s.delivery_time);
        atual.caixasCotadas += 1;
      } else {
        porServico.set(s.name, { valor: Number(s.price), prazoDias: s.delivery_time, caixasCotadas: 1 });
      }
    }
  }

  // Ordenado do mais barato pro mais caro — o checkout usa a primeira posição
  // como pré-selecionada e lista o resto como alternativa.
  const opcoes: OpcaoFrete[] = [];
  for (const [servico, dado] of porServico) {
    if (dado.caixasCotadas === caixas.length) {
      opcoes.push({ valor: dado.valor, prazoDias: dado.prazoDias, servico });
    }
  }
  if (opcoes.length === 0) {
    console.error("[frete] SuperFrete: nenhum serviço cotou em todas as caixas", caixas.length);
    return null;
  }

  return opcoes.sort((a, b) => a.valor - b.valor);
}

// Aceita "01310-100" ou "01310100"; devolve null quando não são 8 dígitos.
export function normalizarCep(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length === 8 ? digitos : null;
}

export function formatarCep(cep: string) {
  const digitos = cep.replace(/\D/g, "");
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : cep;
}
