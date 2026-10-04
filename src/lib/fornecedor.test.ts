import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calcularSync,
  chaveUrlFornecedor,
  espelharVariacoes,
  extrairDadosProduto,
  extrairUrlsProdutos,
  precoComMargem,
  extrairImagemPrincipal,
  extrairVariantesNuvemshop,
  normalizarOpcao,
  ultimoHorarioAgendado,
  urlImagemFornecedor,
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
      { opcoes: ["Preto", "P"], disponivel: false, estoque: 0, preco: 11.9, imagem: null },
      { opcoes: ["Branco", "P"], disponivel: true, estoque: null, preco: 11.9, imagem: null },
      { opcoes: ["Azul", "M"], disponivel: true, estoque: 12, preco: 12.5, imagem: null },
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

describe("página real da Sete Malhas (fixture)", () => {
  it("lê cor, tamanho e preço de todas as variantes", () => {
    const html = readFileSync(new URL("./fixtures/setemalhas-produto.html", import.meta.url), "utf8");
    const v = extrairVariantesNuvemshop(html);
    expect(v.length).toBeGreaterThan(0);
    for (const x of v) {
      expect(x.opcoes.length).toBe(2);
      expect(x.preco).toBeGreaterThan(0);
    }
  });
});

describe("espelharVariacoes", () => {
  const v = (cor: string, tam: string): VarianteFornecedor => ({
    opcoes: [cor, tam],
    disponivel: true,
    estoque: null,
    preco: 10,
  });
  const lojaLa = [v("Preto", "P"), v("Preto", "M"), v("Azul Marinho", "P"), v("Azul Marinho", "M")];

  it("cria o que só existe no fornecedor e apaga o que sumiu", () => {
    const r = espelharVariacoes(
      [
        { tipo: "Cor", valores: ["Preto", "Verde"] },
        { tipo: "Tamanho", valores: ["P"] },
      ],
      lojaLa
    );
    expect(r.mudou).toBe(true);
    expect(r.variacoes).toEqual([
      { indice: 0, coluna: 0, tipo: "Cor", valores: ["Preto", "Azul Marinho"] },
      { indice: 1, coluna: 1, tipo: "Tamanho", valores: ["P", "M"] },
    ]);
    expect(r.removidos).toEqual([{ indice: 0, valor: "Verde" }]);
    expect(r.adicionados).toEqual(["Azul Marinho", "M"]);
  });

  it("mantém a grafia daqui e não acusa mudança quando já está igual", () => {
    const r = espelharVariacoes(
      [
        { tipo: "Cor", valores: ["preto", "Azul marinho"] },
        { tipo: "Tamanho", valores: ["P", "M"] },
      ],
      lojaLa
    );
    expect(r.mudou).toBe(false);
    expect(r.variacoes[0].valores).toEqual(["preto", "Azul marinho"]);
  });

  it("produto sem variações aqui nasce com Cor e Tamanho", () => {
    const r = espelharVariacoes([], lojaLa);
    expect(r.variacoes).toEqual([
      { indice: null, coluna: 0, tipo: "Cor", valores: ["Preto", "Azul Marinho"] },
      { indice: null, coluna: 1, tipo: "Tamanho", valores: ["P", "M"] },
    ]);
  });

  it("não mexe quando o fornecedor não tem opções", () => {
    const r = espelharVariacoes(
      [{ tipo: "Cor", valores: ["Preto"] }],
      [{ opcoes: [], disponivel: true, estoque: null, preco: 10 }]
    );
    expect(r.mudou).toBe(false);
    expect(r.variacoes).toEqual([]);
  });
});

describe("imagens do fornecedor", () => {
  it("normaliza e só aceita o CDN da Nuvemshop", () => {
    expect(urlImagemFornecedor("//acdn-us.mitiendanube.com/a.webp")).toBe("https://acdn-us.mitiendanube.com/a.webp");
    expect(urlImagemFornecedor("https://evil.com/a.png")).toBeNull();
    expect(urlImagemFornecedor("http://x.mitiendanube.com/a.png")).toBe("https://x.mitiendanube.com/a.png");
    expect(urlImagemFornecedor("ftp://x.mitiendanube.com/a.png")).toBeNull();
    expect(urlImagemFornecedor(null)).toBeNull();
  });

  it("lê a foto de cada variante e a og:image", () => {
    const html = readFileSync(new URL("./fixtures/setemalhas-produto.html", import.meta.url), "utf8");
    expect(extrairVariantesNuvemshop(html).every((v) => v.imagem?.startsWith("https://"))).toBe(true);
    expect(
      extrairImagemPrincipal('<meta property="og:image" content="//a.mitiendanube.com/p.jpg" />')
    ).toBe("https://a.mitiendanube.com/p.jpg");
  });
});

describe("importação do fornecedor", () => {
  it("pega só links de produto do sitemap", () => {
    const xml = `<urlset><url><loc>https://setemalhas.com/</loc></url>
      <url><loc>https://setemalhas.com/produtos/</loc></url>
      <url><loc>https://setemalhas.com/produtos/short-tactel/</loc></url>
      <url><loc>https://setemalhas.com/produtos/short-tactel/</loc></url>
      <url><loc>https://setemalhas.com/produtos/categoria/x/</loc></url>
      <url><loc>http://setemalhas.com/produtos/inseguro/</loc></url></urlset>`;
    expect(extrairUrlsProdutos(xml)).toEqual(["https://setemalhas.com/produtos/short-tactel/"]);
  });

  it("compara links ignorando barra final e www", () => {
    expect(chaveUrlFornecedor("https://www.setemalhas.com/produtos/a/")).toBe(
      chaveUrlFornecedor("https://setemalhas.com/produtos/a")
    );
  });

  it("lê nome e descrição", () => {
    const html = '<meta property="og:description" content="Leve &amp; macio"><h1 class="x"> Short <b>Tactel</b> </h1>';
    expect(extrairDadosProduto(html)).toEqual({ nome: "Short Tactel", descricao: "Leve & macio" });
  });

  it("aplica a margem", () => {
    expect(precoComMargem(11.9, 100)).toBe(23.8);
    expect(precoComMargem(11.9, 0)).toBe(11.9);
  });
});
