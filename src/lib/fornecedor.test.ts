import { describe, expect, it } from "vitest";
import {
  calcularSync,
  chaveUrlFornecedor,
  espelharVariacoes,
  extrairImagemPrincipalLoja,
  extrairVariantesLoja,
  normalizarOpcao,
  precoComMargem,
  referenciaDoLink,
  ultimoHorarioAgendado,
  urlFotoFornecedor,
  urlProdutoLoja,
  validarUrlFornecedor,
  type ProdutoLojaFornecedor,
  type VarianteFornecedor,
} from "./fornecedor";

function variante(opcoes: string[], disponivel: boolean, estoque: number | null = null): VarianteFornecedor {
  return { opcoes, disponivel, estoque, preco: 11.9 };
}

function produtoFornecedor(dados: Partial<ProdutoLojaFornecedor>): ProdutoLojaFornecedor {
  return {
    id: "p1",
    nome: "Short Tactel",
    referencia: "ST878392",
    descricao: "Leve e confortável",
    preco: 11.9,
    foto: null,
    cores: [],
    tamanhos: [],
    fotos_cores: null,
    estoque: null,
    estoque_infinito: null,
    precos_var: null,
    ...dados,
  };
}

describe("extrairVariantesLoja", () => {
  it("cruza cor x tamanho, com estoque e disponibilidade de cada combinação", () => {
    const p = produtoFornecedor({
      cores: ["Preto", "Branco"],
      tamanhos: ["P", "M"],
      estoque: { Preto: { P: 0, M: 5 }, Branco: { P: 3, M: 0 } },
    });
    expect(extrairVariantesLoja(p)).toEqual([
      { opcoes: ["Preto", "P"], disponivel: false, estoque: 0, preco: 11.9, imagem: null },
      { opcoes: ["Preto", "M"], disponivel: true, estoque: 5, preco: 11.9, imagem: null },
      { opcoes: ["Branco", "P"], disponivel: true, estoque: 3, preco: 11.9, imagem: null },
      { opcoes: ["Branco", "M"], disponivel: false, estoque: 0, preco: 11.9, imagem: null },
    ]);
  });

  it("estoque_infinito vira estoque null e sempre disponível", () => {
    const p = produtoFornecedor({
      cores: ["Preto"],
      tamanhos: ["P", "M"],
      estoque: { Preto: { P: 0, M: 0 } },
      estoque_infinito: { Preto: ["P"] },
    });
    expect(extrairVariantesLoja(p)).toEqual([
      { opcoes: ["Preto", "P"], disponivel: true, estoque: null, preco: 11.9, imagem: null },
      { opcoes: ["Preto", "M"], disponivel: false, estoque: 0, preco: 11.9, imagem: null },
    ]);
  });

  it("preco_var sobrescreve o preço base da combinação", () => {
    const p = produtoFornecedor({
      cores: ["Amarelo"],
      tamanhos: ["P"],
      estoque: { Amarelo: { P: 10 } },
      precos_var: { Amarelo: { P: 9.9 } },
    });
    expect(extrairVariantesLoja(p)[0].preco).toBe(9.9);
  });

  it("usa a foto da cor quando o fornecedor informa", () => {
    const p = produtoFornecedor({
      cores: ["Preto"],
      tamanhos: ["P"],
      estoque: { Preto: { P: 1 } },
      fotos_cores: { Preto: "2455666b/produtos/foto.png" },
    });
    expect(extrairVariantesLoja(p)[0].imagem).toBe(
      "https://wvvbvkmddehdyoozbnkx.supabase.co/storage/v1/object/public/loja/2455666b/produtos/foto.png"
    );
  });

  it("sem cor ou sem tamanho: variação única sem controle", () => {
    expect(extrairVariantesLoja(produtoFornecedor({}))).toEqual([
      { opcoes: [], disponivel: true, estoque: null, preco: 11.9, imagem: null },
    ]);
  });
});

describe("urlFotoFornecedor", () => {
  it("monta a URL do bucket público a partir do caminho", () => {
    expect(urlFotoFornecedor("2455666b/produtos/foto.png")).toBe(
      "https://wvvbvkmddehdyoozbnkx.supabase.co/storage/v1/object/public/loja/2455666b/produtos/foto.png"
    );
  });

  it("recusa caminho que já é uma URL de outro lugar", () => {
    expect(urlFotoFornecedor("https://evil.com/a.png")).toBeNull();
    expect(urlFotoFornecedor("//evil.com/a.png")).toBeNull();
    expect(urlFotoFornecedor(null)).toBeNull();
    expect(urlFotoFornecedor("")).toBeNull();
  });
});

describe("extrairImagemPrincipalLoja", () => {
  it("monta a URL a partir do campo foto do produto", () => {
    expect(extrairImagemPrincipalLoja(produtoFornecedor({ foto: "a/b.png" }))).toBe(
      "https://wvvbvkmddehdyoozbnkx.supabase.co/storage/v1/object/public/loja/a/b.png"
    );
  });

  it("sem foto, null", () => {
    expect(extrairImagemPrincipalLoja(produtoFornecedor({ foto: null }))).toBeNull();
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

describe("importação do fornecedor", () => {
  it("monta o link do produto pela referência", () => {
    expect(urlProdutoLoja("https://www.setemalhas.com", "ST 878392")).toBe(
      "https://www.setemalhas.com/?produto=ST%20878392"
    );
  });

  it("lê a referência de volta do link", () => {
    expect(referenciaDoLink("https://www.setemalhas.com/?produto=ST878392")).toBe("ST878392");
    expect(referenciaDoLink("https://www.setemalhas.com/")).toBeNull();
    expect(referenciaDoLink("não é url")).toBeNull();
  });

  it("compara links do mesmo produto ignorando www", () => {
    expect(chaveUrlFornecedor("https://www.setemalhas.com/?produto=ST878392")).toBe(
      chaveUrlFornecedor("https://setemalhas.com/?produto=st878392")
    );
  });

  it("aplica a margem", () => {
    expect(precoComMargem(11.9, 100)).toBe(23.8);
    expect(precoComMargem(11.9, 0)).toBe(11.9);
  });
});
