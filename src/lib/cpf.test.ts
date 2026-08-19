import { describe, it, expect } from "vitest";
import { apenasDigitos, cpfValido, formatarCpf } from "./cpf";

describe("apenasDigitos", () => {
  it("tira pontuação da máscara", () => {
    expect(apenasDigitos("529.982.247-25")).toBe("52998224725");
  });

  it("ignora letras e espaços", () => {
    expect(apenasDigitos(" 529 abc 982 ")).toBe("529982");
  });
});

describe("formatarCpf", () => {
  it("vai colocando a máscara conforme digita", () => {
    expect(formatarCpf("529")).toBe("529");
    expect(formatarCpf("5299")).toBe("529.9");
    expect(formatarCpf("529982")).toBe("529.982");
    expect(formatarCpf("5299822")).toBe("529.982.2");
    expect(formatarCpf("5299822472")).toBe("529.982.247-2");
  });

  it("formata o CPF completo", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  it("descarta o que passar de 11 dígitos", () => {
    expect(formatarCpf("5299822472599")).toBe("529.982.247-25");
  });

  it("reformata valor que já vem com máscara", () => {
    expect(formatarCpf("529.982.247-25")).toBe("529.982.247-25");
  });
});

describe("cpfValido", () => {
  it("aceita CPF com dígitos verificadores corretos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("aceita CPF cujo dígito verificador é zero", () => {
    expect(cpfValido("111.444.777-35")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false);
  });

  it("recusa quantidade de dígitos diferente de 11", () => {
    expect(cpfValido("529.982.247")).toBe(false);
    expect(cpfValido("529982247255")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });

  it("recusa sequência de dígitos repetidos", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
  });
});
