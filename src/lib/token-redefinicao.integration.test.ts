import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// O token de redefinição é cripto pura, mas a propriedade que importa — o link
// valer uma vez só — depende do hash da senha guardado no banco. Por isso a
// suíte é de integração: trocar a senha de verdade é o que precisa invalidar
// um link já emitido.
//
// `next/headers` só é usado pelo cookie de sessão, que nada aqui exercita;
// fora de uma request do Next ele não carrega, então sai do caminho.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("cookies() não é usado nesta suíte");
  },
}));

process.env.SESSION_SECRET ??= "segredo-de-teste";

const { prisma } = await import("@/lib/prisma");
const { gerarTokenRedefinicao, usuarioIdDoTokenRedefinicao } = await import("@/lib/session");
const { redefinirSenhaComToken } = await import("@/lib/data/usuarios");

const USUARIO_ID = "teste-reset-usuario";

async function buscarSenhaHash(id: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { senhaHash: true } });
  return usuario?.senhaHash ?? null;
}

async function senhaHashAtual() {
  const hash = await buscarSenhaHash(USUARIO_ID);
  if (!hash) throw new Error("usuário de teste sumiu");
  return hash;
}

beforeAll(async () => {
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
  await prisma.usuario.create({
    data: {
      id: USUARIO_ID,
      nome: "Cliente de teste",
      email: "teste-reset@example.com",
      senhaHash: "hash-inicial",
    },
  });
});

afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
  await prisma.$disconnect();
});

describe("token de redefinição de senha", () => {
  it("aceita o token recém-emitido", async () => {
    const token = gerarTokenRedefinicao(USUARIO_ID, await senhaHashAtual());
    expect(await usuarioIdDoTokenRedefinicao(token, buscarSenhaHash)).toBe(USUARIO_ID);
  });

  it("para de valer depois que a senha muda — o link é de uso único", async () => {
    const token = gerarTokenRedefinicao(USUARIO_ID, await senhaHashAtual());

    await redefinirSenhaComToken(USUARIO_ID, "senha-nova-123");

    expect(await usuarioIdDoTokenRedefinicao(token, buscarSenhaHash)).toBeNull();
  });

  it("recusa token com assinatura adulterada", async () => {
    const token = gerarTokenRedefinicao(USUARIO_ID, await senhaHashAtual());
    const cru = Buffer.from(token, "base64url").toString("utf8");
    const [marca, usuarioId, expiraEm] = cru.split(".");
    const forjado = Buffer.from(`${marca}.${usuarioId}.${expiraEm}.assinaturafalsa`).toString(
      "base64url"
    );

    expect(await usuarioIdDoTokenRedefinicao(forjado, buscarSenhaHash)).toBeNull();
  });

  it("recusa token expirado", async () => {
    const hash = await senhaHashAtual();
    vi.useFakeTimers();
    try {
      const token = gerarTokenRedefinicao(USUARIO_ID, hash);
      // O token vale 1 hora; 2 horas depois já não deve fechar.
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      expect(await usuarioIdDoTokenRedefinicao(token, buscarSenhaHash)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("recusa token de usuário que não existe mais", async () => {
    const token = gerarTokenRedefinicao("usuario-que-nao-existe", "hash-qualquer");
    expect(await usuarioIdDoTokenRedefinicao(token, buscarSenhaHash)).toBeNull();
  });
});
