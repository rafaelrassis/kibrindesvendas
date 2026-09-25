import { describe, expect, it } from "vitest";
import {
  calcularSync,
  extrairVariantesNuvemshop,
  normalizarOpcao,
  ultimoHorarioAgendado,
  validarUrlFornecedor,
  type VarianteFornecedor,
} from "./fornecedor";

function variante(opcoes: string[], disponivel: boolean, estoque: number | null = null): VarianteFornecedor {
  return { opcoes, disponivel, estoque, preco: 11.9 };
}

describe("extrairVariantesNuvemshop", () => {
  const principal = [
    { option0: "Preto", option1: "P", option2: null, stock: 0, available: false, price_number: 11.9 },
    { option0: "Branco", option1: "P", option2: null, stock: null, available: true, price_number: 11.9 },
    { option0: "Azul", option1: "M", option2: null, stock: 12, available: true, price_number: 12.5 },
  ];
  const relacionado = [{ option0: "Outro", stock: 5, available: true, price_number: 1 }];

  it("lê o LS.variants do produto principal, ignorando relacionados", () => {
    const html = `
      <div class="js-product-container js-item-product" data-variants="${JSON.stringify(relacionado).replace(/"/g, "&quot;")}"></div>
      <script>LS.variants = ${JSON.stringify(principal)}; LS.x = "]";</script>`;
    expect(extrairVariantesNuvemshop(html)).toEqual([
      { opcoes: ["Preto", "P"], disponivel: false, estoque: 0, preco: 11.9 },
      { opcoes: ["Branco", "P"], disponivel: true, estoque: null, preco: 11.9 },
      { opcoes: ["Azul", "M"], disponivel: true, estoque: 12, preco: 12.5 },
    ]);
  });

  it("sem LS.variants, cai no data-variants do container principal", () => {
    const html = `
      <div class="js-product-container js-item-product" data-variants="${JSON.stringify(relacionado).replace(/"/g, "&quot;")}"></div>
      <div class="js-product-container js-has-new-shipping" data-variants="${JSON.stringify(principal).replace(/"/g, "&quot;")}"></div>`;
    expect(extrairVariantesNuvemshop(html)).toHaveLength(3);
  });

  it("página sem variações dá erro legível", () => {
    expect(() => extrairVariantesNuvemshop("<html>Página não encontrada</html>")).toThrow(
      /Não achei as variações/
    );
  });
});

describe("normalizarOpcao", () => {
  it("ignora acento, caixa e espaços", () => {
    expect(normalizarOpcao("  Bordô  ")).toBe(normalizarOpcao("bordo"));
    expect(normalizarOpcao("Azul   Marinho")).toBe("azul marinho");
  });
});

describe("calcularSync", () => {
  const variantes = [
    variante(["Preto", "P"], false, 0),
    variante(["Preto", "M"], false, 0),
    variante(["Branco", "P"], true),
    variante(["Branco", "M"], true, 7),
  ];

  it("zera o indisponível e usa o estoque do fornecedor quando informado", () => {
    const r = calcularSync(
      {
        variacoes: [
          { tipo: "Cor", valores: ["Preto", "Branco"] },
          { tipo: "Tamanho", valores: ["P", "M"] },
        ],
        estoque: null,
        estoqueVariacoes: [
          { combinacao: "Cor:Preto|Tamanho:P", estoque: 10 },
          { combinacao: "Cor:Preto|Tamanho:M", estoque: 0 },
          { combinacao: "Cor:Branco|Tamanho:P", estoque: 0 },
          { combinacao: "Cor:Branco|Tamanho:M", estoque: 3 },
        ],
      },
      variantes,
      50
    );
    expect(r.grade).toEqual([
      { combinacao: "Cor:Preto|Tamanho:P", estoque: 0 },
      { combinacao: "Cor:Preto|Tamanho:M", estoque: 0 },
      { combinacao: "Cor:Branco|Tamanho:P", estoque: 50 },
      { combinacao: "Cor:Branco|Tamanho:M", estoque: 7 },
    ]);
    expect(r.zeradas).toEqual(["Preto / P"]);
    expect(r.reativadas).toEqual(["Branco / P"]);
    expect(r.esgotadoTotal).toBe(false);
  });

  it("só cor aqui, cor + tamanho lá: disponível se algum tamanho estiver", () => {
    const r = calcularSync(
      {
        variacoes: [{ tipo: "Cor", valores: ["preto", "BRANCO"] }],
        estoque: null,
        estoqueVariacoes: [],
      },
      variantes,
      50
    );
    expect(r.grade).toEqual([
      { combinacao: "Cor:preto", estoque: 0 },
      { combinacao: "Cor:BRANCO", estoque: 50 },
    ]);
  });

  it("controle desligado e nada esgotado: não liga o controle", () => {
    const r = calcularSync(
      { variacoes: [{ tipo: "Cor", valores: ["Branco"] }], estoque: null, estoqueVariacoes: [] },
      variantes,
      50
    );
    expect(r.grade).toBeUndefined();
  });

  it("valor sem correspondente vira aviso e não é zerado", () => {
    const r = calcularSync(
      {
        variacoes: [{ tipo: "Cor", valores: ["Preto", "Rosa"] }],
        estoque: null,
        estoqueVariacoes: [
          { combinacao: "Cor:Preto", estoque: 5 },
          { combinacao: "Cor:Rosa", estoque: 4 },
        ],
      },
      variantes,
      50
    );
    expect(r.semCorrespondencia).toEqual(["Rosa"]);
    expect(r.grade).toContainEqual({ combinacao: "Cor:Rosa", estoque: 4 });
  });

  it("sem variação: esgotado total zera e marca esgotadoTotal", () => {
    const r = calcularSync(
      { variacoes: [], estoque: null, estoqueVariacoes: [] },
      [variante(["Único"], false, 0)],
      50
    );
    expect(r.estoque).toBe(0);
    expect(r.esgotadoTotal).toBe(true);
  });

  it("sem variação: voltou disponível sem número, repõe", () => {
    const r = calcularSync(
      { variacoes: [], estoque: 0, estoqueVariacoes: [] },
      [variante([], true)],
      30
    );
    expect(r.estoque).toBe(30);
    expect(r.reativadas).toEqual(["produto"]);
  });

  it("sem variação e sem controle, disponível: não mexe", () => {
    const r = calcularSync({ variacoes: [], estoque: null, estoqueVariacoes: [] }, [variante([], true)], 30);
    expect(r.estoque).toBeUndefined();
  });
});

describe("ultimoHorarioAgendado", () => {
  // 2026-09-25 é sexta (5). 12:00 UTC = 09:00 em Brasília.
  const agora = new Date("2026-09-25T12:00:00Z");

  it("pega o horário de hoje que já passou", () => {
    expect(ultimoHorarioAgendado(agora, [5], ["08:00", "18:00"])?.toISOString()).toBe(
      "2026-09-25T11:00:00.000Z"
    );
  });

  it("volta pro dia agendado anterior quando hoje ainda não chegou a hora", () => {
    expect(ultimoHorarioAgendado(agora, [3], ["10:00"])?.toISOString()).toBe(
      "2026-09-23T13:00:00.000Z"
    );
  });

  it("sem dias ou horários, null", () => {
    expect(ultimoHorarioAgendado(agora, [], ["08:00"])).toBeNull();
    expect(ultimoHorarioAgendado(agora, [5], [])).toBeNull();
  });
});

describe("validarUrlFornecedor", () => {
  it("aceita https com domínio", () => {
    expect(validarUrlFornecedor(" https://setemalhas.com/produtos/x ")).toBe(
      "https://setemalhas.com/produtos/x"
    );
  });

  it("recusa http, IP e localhost", () => {
    expect(validarUrlFornecedor("http://setemalhas.com/x")).toBeNull();
    expect(validarUrlFornecedor("https://127.0.0.1/x")).toBeNull();
    expect(validarUrlFornecedor("https://localhost/x")).toBeNull();
    expect(validarUrlFornecedor("https://[::1]/x")).toBeNull();
  });
});
