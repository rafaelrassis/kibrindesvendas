import { describe, expect, it } from "vitest";
import { linkWhatsappCliente, mensagemCarrinhoWhatsapp, telefoneParaWhatsapp } from "./whatsapp";

describe("telefoneParaWhatsapp", () => {
  it("celular com DDD ganha o 55", () => {
    expect(telefoneParaWhatsapp("(11) 91234-5678")).toBe("5511912345678");
  });
  it("fixo com DDD ganha o 55", () => {
    expect(telefoneParaWhatsapp("11 3456-7890")).toBe("551134567890");
  });
  it("número que já vem com 55 fica como está", () => {
    expect(telefoneParaWhatsapp("+55 11 91234-5678")).toBe("5511912345678");
  });
  it("número curto, longo demais ou vazio é inválido", () => {
    expect(telefoneParaWhatsapp("1234-5678")).toBeNull();
    expect(telefoneParaWhatsapp("0000000000000000")).toBeNull();
    expect(telefoneParaWhatsapp("")).toBeNull();
    expect(telefoneParaWhatsapp(null)).toBeNull();
  });
});

describe("linkWhatsappCliente", () => {
  it("monta o link com o primeiro nome na mensagem", () => {
    const link = linkWhatsappCliente("11912345678", "Maria da Silva")!;
    expect(link.startsWith("https://wa.me/5511912345678?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toContain("Oi, Maria!");
  });
  it("sem telefone válido não há link", () => {
    expect(linkWhatsappCliente("123", "Maria")).toBeNull();
  });
});

describe("mensagemCarrinhoWhatsapp", () => {
  it("carrinho acima do limite cita frete grátis", () => {
    expect(mensagemCarrinhoWhatsapp("Ana", 150, 100)).toMatch(/já tem frete grátis/);
  });
  it("perto do limite diz quanto falta", () => {
    const m = mensagemCarrinhoWhatsapp("Ana", 80, 100);
    expect(m).toMatch(/faltam só/);
    expect(m).toMatch(/20,00/);
  });
  it("longe do limite ou sem limite usa a mensagem simples", () => {
    expect(mensagemCarrinhoWhatsapp("Ana", 20, 100)).not.toMatch(/frete/);
    expect(mensagemCarrinhoWhatsapp("Ana", 200, null)).not.toMatch(/frete/);
  });
});
