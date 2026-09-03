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

// Dimensões de 1 unidade, em milímetros. `espessuraMm` é a única que empilha
// com a quantidade (ver cotarFreteSuperFrete); as APIs de frete trabalham em
// cm, então convertemos (mm / 10) na hora de montar o payload.
export type PacoteFrete = {
  pesoMiligramas: number;
  espessuraMm: number;
  alturaMm: number;
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
        width: Math.max(pacote.alturaMm / 10, MIN_LARGURA_CM),
        height: Math.max(pacote.espessuraMm / 10, MIN_ALTURA_CM),
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

// Ao contrário do cotarFreteMelhorEnvio (que fica só com a mais barata), esta
// função devolve todas as opções válidas, pra o cliente escolher no checkout.
//
// Diferente do Melhor Envio, o `quantity` da calculadora v0 do SuperFrete não
// serve só pra somar peso: pra alguns serviços (ex: Mini Envios) ele entra na
// cubagem só quando "sobra" acima de um certo limite, aí o SuperFrete decide
// sozinho um novo formato de caixa (confirmado com o suporte: viramos um
// cubo de 27x27x27cm do nada com `quantity: 25`, em vez de simplesmente
// empilhar). Por isso sempre mandamos `quantity: 1` e fazemos a cubagem nós
// mesmos: a pilha de `unidades` cresce em espessura (a base
// altura x comprimento do produto não muda), e o peso é o total embarcado.
export async function cotarFreteSuperFrete(
  token: string,
  cepOrigem: string,
  cepDestino: string,
  pacote: PacoteFrete,
  quantidade = 1
): Promise<OpcaoFrete[] | null> {
  const unidades = Math.max(1, Math.round(quantidade) || 1);
  const body = {
    from: { postal_code: cepOrigem },
    to: { postal_code: cepDestino },
    services: SERVICOS_DESPACHADOS,
    options: { insurance_value: 0, use_insurance_value: false, own_hand: false, receipt: false },
    products: [
      {
        width: Math.max(pacote.alturaMm / 10, MIN_LARGURA_CM),
        height: Math.max((pacote.espessuraMm * unidades) / 10, MIN_ALTURA_CM),
        length: Math.max(pacote.comprimentoMm / 10, MIN_COMPRIMENTO_CM),
        weight: (Math.max(pacote.pesoMiligramas, 1) * unidades) / 1_000_000,
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

  // Ordenado do mais barato pro mais caro — o checkout usa a primeira posição
  // como pré-selecionada e lista o resto como alternativa.
  return validos
    .map((s) => ({ valor: Number(s.price), prazoDias: s.delivery_time, servico: s.name }))
    .sort((a, b) => a.valor - b.valor);
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
