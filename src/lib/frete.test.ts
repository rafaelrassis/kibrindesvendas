import { describe, it, expect, vi, afterEach } from "vitest";
import {
  calcularFrete,
  cotarFreteMelhorEnvio,
  cotarFreteSuperFrete,
  formatarCep,
  normalizarCep,
} from "./frete";

describe("calcularFrete", () => {
  it("cobra o menor valor pra SP, que é a origem da loja", () => {
    const frete = calcularFrete("SP");
    expect(frete.valor).toBe(9.9);
    expect(frete.prazoDias).toBe(2);
  });

  it("cobra mais caro e demora mais pra região Norte", () => {
    const sp = calcularFrete("SP");
    const norte = calcularFrete("AM");
    expect(norte.valor).toBeGreaterThan(sp.valor);
    expect(norte.prazoDias).toBeGreaterThan(sp.prazoDias);
  });

  it("aceita a UF em minúsculo e com espaços", () => {
    expect(calcularFrete(" sp ")).toEqual(calcularFrete("SP"));
  });

  it("cai na faixa mais cara quando a UF é desconhecida, em vez de sair de graça", () => {
    expect(calcularFrete("XX")).toEqual(calcularFrete("AM"));
  });

  it("nunca fica mais barato que SP, em nenhuma região", () => {
    const spValor = calcularFrete("SP").valor;
    for (const uf of ["RJ", "MG", "PR", "RS", "BA", "PE", "AM", "PA"]) {
      expect(calcularFrete(uf).valor).toBeGreaterThanOrEqual(spValor);
    }
  });
});

describe("normalizarCep", () => {
  it("tira a máscara e devolve só os 8 dígitos", () => {
    expect(normalizarCep("01310-100")).toBe("01310100");
    expect(normalizarCep("01310100")).toBe("01310100");
  });

  it("devolve null quando não são 8 dígitos", () => {
    expect(normalizarCep("1234")).toBeNull();
    expect(normalizarCep("013101000")).toBeNull();
    expect(normalizarCep("")).toBeNull();
  });
});

describe("formatarCep", () => {
  it("põe o hífen no lugar certo", () => {
    expect(formatarCep("01310100")).toBe("01310-100");
  });

  it("devolve o valor original quando não dá pra formatar", () => {
    expect(formatarCep("1234")).toBe("1234");
  });
});

describe("cotarFreteMelhorEnvio", () => {
  const pacote = { pesoMiligramas: 300000, alturaMm: 40, larguraMm: 110, comprimentoMm: 160 };

  function respostaCom(servicos: unknown) {
    return {
      ok: true,
      json: async () => servicos,
      text: async () => JSON.stringify(servicos),
    } as unknown as Response;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fica com a opção mais barata entre as que voltaram", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaCom([
          { id: 2, name: "SEDEX", price: "42.10", delivery_time: 2, company: { name: "Correios" } },
          { id: 1, name: "PAC", price: "23.50", delivery_time: 7, company: { name: "Correios" } },
        ])
      )
    );

    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toEqual({
      valor: 23.5,
      prazoDias: 7,
    });
  });

  it("ignora serviços com erro (transportadora que não atende a rota)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaCom([
          { id: 1, name: "PAC", price: "9.90", delivery_time: 5, company: { name: "X" }, error: "Rota não atendida" },
          { id: 2, name: "SEDEX", price: "42.10", delivery_time: 2, company: { name: "Correios" } },
        ])
      )
    );

    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toEqual({
      valor: 42.1,
      prazoDias: 2,
    });
  });

  it("converte de milímetros pra centímetros e respeita a dimensão mínima dos Correios", async () => {
    let enviado: { products: { width: number; height: number; length: number; weight: number }[] } | null =
      null;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      enviado = JSON.parse(init.body);
      return respostaCom([
        { id: 1, name: "PAC", price: "20.00", delivery_time: 5, company: { name: "Correios" } },
      ]);
    });

    await cotarFreteMelhorEnvio("token", "01310100", "60000000", {
      pesoMiligramas: 250000,
      alturaMm: 10,
      larguraMm: 50,
      comprimentoMm: 80,
    });

    expect(enviado!.products[0]).toMatchObject({
      height: 2,
      width: 11,
      length: 16,
      weight: 0.25,
    });
  });

  it("manda a quantidade de unidades no `quantity` do produto, sem multiplicar o peso", async () => {
    let enviado: { products: { weight: number; quantity: number }[] } | null = null;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      enviado = JSON.parse(init.body);
      return respostaCom([
        { id: 1, name: "PAC", price: "20.00", delivery_time: 5, company: { name: "Correios" } },
      ]);
    });

    await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote, 3);

    expect(enviado!.products[0]).toMatchObject({ weight: 0.3, quantity: 3 });
  });

  it("cai pra quantidade 1 quando não é passada ou vem inválida", async () => {
    let enviado: { products: { quantity: number }[] } | null = null;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      enviado = JSON.parse(init.body);
      return respostaCom([
        { id: 1, name: "PAC", price: "20.00", delivery_time: 5, company: { name: "Correios" } },
      ]);
    });

    await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote, 0);
    expect(enviado!.products[0].quantity).toBe(1);
  });

  it("devolve null quando a API responde erro, pra chamada cair na estimativa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toBeNull();
  });

  it("devolve null quando a rede falha ou estoura o timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      })
    );
    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toBeNull();
  });

  it("devolve null quando nenhuma opção sobrou", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaCom([])));
    expect(await cotarFreteMelhorEnvio("token", "01310100", "60000000", pacote)).toBeNull();
  });
});

describe("cotarFreteSuperFrete", () => {
  const pacote = { pesoMiligramas: 300000, alturaMm: 40, larguraMm: 110, comprimentoMm: 160 };

  function respostaCom(servicos: unknown) {
    return {
      ok: true,
      json: async () => servicos,
      text: async () => JSON.stringify(servicos),
    } as unknown as Response;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve todas as opções válidas, ordenadas da mais barata pra mais cara", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaCom([
          { id: 2, name: "SEDEX", price: 42.1, delivery_time: 2, company: { name: "Correios" } },
          { id: 1, name: "PAC", price: 23.5, delivery_time: 7, company: { name: "Correios" } },
        ])
      )
    );

    expect(await cotarFreteSuperFrete("token", "01310100", "60000000", pacote)).toEqual([
      { valor: 23.5, prazoDias: 7, servico: "PAC" },
      { valor: 42.1, prazoDias: 2, servico: "SEDEX" },
    ]);
  });

  it("ignora serviços com erro (transportadora que não atende a rota)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaCom([
          { id: 1, name: "PAC", price: 9.9, delivery_time: 5, company: { name: "X" }, has_error: true },
          { id: 2, name: "SEDEX", price: 42.1, delivery_time: 2, company: { name: "Correios" } },
        ])
      )
    );

    expect(await cotarFreteSuperFrete("token", "01310100", "60000000", pacote)).toEqual([
      { valor: 42.1, prazoDias: 2, servico: "SEDEX" },
    ]);
  });

  it("devolve null quando a API responde erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    expect(await cotarFreteSuperFrete("token", "01310100", "60000000", pacote)).toBeNull();
  });

  it("devolve null quando a rede falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      })
    );
    expect(await cotarFreteSuperFrete("token", "01310100", "60000000", pacote)).toBeNull();
  });

  it("empilha a altura e multiplica o peso pela quantidade, mandando quantity fixo em 1 pra não sofrer reclassificação de serviço por cubagem", async () => {
    let enviado: {
      services: string;
      products: { height: number; width: number; length: number; weight: number; quantity: number }[];
    } | null = null;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      enviado = JSON.parse(init.body);
      return respostaCom([
        { id: 1, name: "PAC", price: 20.0, delivery_time: 5, company: { name: "Correios" } },
      ]);
    });

    // 100g/unidade x 3 = 300g: cai bem no teto da própria faixa (até 300g),
    // então nem peso nem altura sofrem o arredondamento de faixa — o que
    // isola o que este teste quer verificar (empilhamento por quantidade).
    await cotarFreteSuperFrete(
      "token",
      "01310100",
      "60000000",
      { pesoMiligramas: 100000, alturaMm: 40, larguraMm: 110, comprimentoMm: 160 },
      3
    );

    expect(enviado!.services).toBe("1,2,31");
    // altura 40mm (4cm) x 3 unidades = 12cm de altura empilhada; largura e
    // comprimento (base do produto) não mudam com a quantidade.
    expect(enviado!.products[0]).toMatchObject({
      height: 12,
      width: 11,
      length: 16,
      weight: 0.3,
      quantity: 1,
    });
  });

  it("arredonda o peso pro teto da faixa (até 300g, depois de 1 em 1kg), nunca cotando abaixo do que a transportadora vai cobrar", async () => {
    let enviado: { products: { weight: number }[] } | null = null;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      enviado = JSON.parse(init.body);
      return respostaCom([
        { id: 1, name: "PAC", price: 10, delivery_time: 5, company: { name: "Correios" } },
      ]);
    });

    // 200mg/unidade (0,2g) — só pra deixar os números do teste redondos.
    const leve = { pesoMiligramas: 200, alturaMm: 1, larguraMm: 110, comprimentoMm: 160 };

    await cotarFreteSuperFrete("token", "01310100", "60000000", leve, 100); // 20g reais
    expect(enviado!.products[0].weight).toBe(0.3); // sobe pro teto de "até 300g"

    await cotarFreteSuperFrete("token", "01310100", "60000000", leve, 4500); // 900g reais
    expect(enviado!.products[0].weight).toBe(1); // sobe pro teto de "até 1kg", não fica em 900g

    await cotarFreteSuperFrete("token", "01310100", "60000000", leve, 5000); // exatamente 1kg
    expect(enviado!.products[0].weight).toBe(1); // já está no teto, não pula pra 2kg
  });

  it("cota igual pra quantidades diferentes que caem na mesma faixa de peso", async () => {
    const pesosEnviados: number[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body);
      pesosEnviados.push(corpo.products[0].weight);
      return respostaCom([
        { id: 1, name: "PAC", price: 10, delivery_time: 5, company: { name: "Correios" } },
      ]);
    });

    const leve = { pesoMiligramas: 200, alturaMm: 1, larguraMm: 110, comprimentoMm: 160 };
    // 2000un = 400g reais e 4000un = 800g reais — os dois pesos ficam entre
    // 300g e 1kg, então caem na mesma faixa ("até 1kg") e cotam igual.
    const [a, b] = await Promise.all([
      cotarFreteSuperFrete("token", "01310100", "60000000", leve, 2000),
      cotarFreteSuperFrete("token", "01310100", "60000000", leve, 4000),
    ]);

    expect(a).toEqual(b);
    expect(new Set(pesosEnviados)).toEqual(new Set([1]));
  });

  it("divide a caixa ao meio quando a rota rejeita, até cada metade caber, e soma o preço", async () => {
    // Não existe um teto fixo — cada rota rejeita num tamanho diferente (visto
    // na prática: uma rota barrou uma caixa de 104cm enquanto outra aceitou
    // 150cm). Aqui simulamos uma rota que só aceita altura <= 200cm: com
    // altura 40mm (4cm) por unidade, 80 unidades (320cm) não cabem de
    // primeira, mas 40+40 unidades (160cm cada) cabem.
    const chamadas: number[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body);
      const height = corpo.products[0].height;
      chamadas.push(height);
      if (height > 200) {
        return { ok: false, text: async () => "rejeitado" } as unknown as Response;
      }
      return respostaCom([
        { id: 1, name: "PAC", price: 10, delivery_time: 3 + chamadas.length, company: { name: "Correios" } },
      ]);
    });

    const opcoes = await cotarFreteSuperFrete("token", "01310100", "60000000", pacote, 80);

    // 1ª tentativa com as 80 inteiras (320cm, rejeitada) + 2 tentativas de 40
    // (160cm cada, aceitas).
    expect(chamadas).toEqual([320, 160, 160]);
    // 2 caixas de R$10 cada = R$20; prazo é o maior entre as caixas.
    expect(opcoes).toEqual([{ valor: 20, prazoDias: 6, servico: "PAC" }]);
  });

  it("não cota nenhum serviço se, depois de dividir, nenhum serviço cobriu todas as caixas", async () => {
    let chamada = 0;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      chamada += 1;
      const corpo = JSON.parse(init.body);
      // a caixa inteira (80 unidades) é rejeitada; ao dividir, cada metade só
      // consegue cotar um serviço diferente — nenhum serviço cobre as duas.
      if (corpo.products[0].height > 200) {
        return { ok: false, text: async () => "rejeitado" } as unknown as Response;
      }
      return respostaCom(
        chamada === 2
          ? [{ id: 1, name: "PAC", price: 10, delivery_time: 5, company: { name: "Correios" } }]
          : [{ id: 2, name: "SEDEX", price: 15, delivery_time: 2, company: { name: "Correios" } }]
      );
    });

    expect(await cotarFreteSuperFrete("token", "01310100", "60000000", pacote, 80)).toBeNull();
  });

  it("desiste depois de um teto de tentativas, numa rota que rejeita até a menor caixa", async () => {
    let chamadas = 0;
    vi.stubGlobal("fetch", async () => {
      chamadas += 1;
      return { ok: false, text: async () => "rejeitado" } as unknown as Response;
    });

    expect(await cotarFreteSuperFrete("token", "01310100", "60000000", pacote, 1000)).toBeNull();
    // nunca deveria chegar perto de tentar unidade por unidade num pedido de 1000
    expect(chamadas).toBeLessThan(30);
  });
});
