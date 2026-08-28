import "server-only";
import { prisma } from "@/lib/prisma";
import { ErroDeNegocio } from "./erros";
import { apenasDigitos, cpfValido } from "@/lib/cpf";
import type { Endereco, Perfil, Preferencias } from "@/lib/conta-data";

// --- Perfil -------------------------------------------------------------
// E-mail não entra aqui: continua trocado só pelo fluxo de segurança (com
// senha), em /conta/seguranca.

export async function getPerfil(usuarioId: string): Promise<Perfil> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true, email: true, telefone: true, cpf: true, aniversario: true },
  });
  if (!u) throw new ErroDeNegocio("Usuário não encontrado.", 404);
  return {
    nome: u.nome,
    email: u.email,
    telefone: u.telefone ?? "",
    cpf: u.cpf ?? "",
    aniversario: u.aniversario ?? "",
  };
}

export async function atualizarPerfil(
  usuarioId: string,
  dados: { nome?: string; telefone?: string; cpf?: string; aniversario?: string }
): Promise<Perfil> {
  const nome = dados.nome?.trim();
  if (!nome) throw new ErroDeNegocio("Informe o nome.");

  const cpfBruto = dados.cpf?.trim();
  if (cpfBruto && !cpfValido(cpfBruto)) {
    throw new ErroDeNegocio("CPF inválido.");
  }

  const u = await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      nome,
      telefone: dados.telefone?.trim() || null,
      // Mesmo formato usado no cadastro (só dígitos) — é o que vai direto pro
      // Mercado Pago na hora de gerar o Pix.
      cpf: cpfBruto ? apenasDigitos(cpfBruto) : null,
      aniversario: dados.aniversario?.trim() || null,
    },
    select: { nome: true, email: true, telefone: true, cpf: true, aniversario: true },
  });
  return {
    nome: u.nome,
    email: u.email,
    telefone: u.telefone ?? "",
    cpf: u.cpf ?? "",
    aniversario: u.aniversario ?? "",
  };
}

// --- Preferências ---------------------------------------------------------

export async function getPreferencias(usuarioId: string): Promise<Preferencias> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { prefEmail: true, prefWhatsapp: true, prefSms: true, prefPromocoes: true },
  });
  if (!u) throw new ErroDeNegocio("Usuário não encontrado.", 404);
  return {
    email: u.prefEmail,
    whatsapp: u.prefWhatsapp,
    sms: u.prefSms,
    promocoes: u.prefPromocoes,
  };
}

export async function atualizarPreferencias(
  usuarioId: string,
  dados: Preferencias
): Promise<Preferencias> {
  const u = await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      prefEmail: !!dados.email,
      prefWhatsapp: !!dados.whatsapp,
      prefSms: !!dados.sms,
      prefPromocoes: !!dados.promocoes,
    },
    select: { prefEmail: true, prefWhatsapp: true, prefSms: true, prefPromocoes: true },
  });
  return {
    email: u.prefEmail,
    whatsapp: u.prefWhatsapp,
    sms: u.prefSms,
    promocoes: u.prefPromocoes,
  };
}

// --- Endereços --------------------------------------------------------------

function paraEndereco(e: {
  id: string;
  rotulo: string;
  destinatario: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  padrao: boolean;
}): Endereco {
  return { ...e, complemento: e.complemento ?? "" };
}

export async function getEnderecos(usuarioId: string): Promise<Endereco[]> {
  const lista = await prisma.endereco.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "asc" },
  });
  return lista.map(paraEndereco);
}

function validarEndereco(e: Partial<Endereco>) {
  const obrigatorios: (keyof Endereco)[] = [
    "rotulo",
    "destinatario",
    "cep",
    "rua",
    "numero",
    "bairro",
    "cidade",
    "uf",
  ];
  for (const campo of obrigatorios) {
    if (!e[campo] || String(e[campo]).trim() === "") {
      throw new ErroDeNegocio(`Campo obrigatório faltando: ${campo}.`);
    }
  }
}

// Só um endereço padrão por usuário: se o salvo pede padrão, os outros
// deixam de ser; se é o primeiro da lista, vira padrão sozinho.
async function ajustarPadrao(usuarioId: string, enderecoId: string, padrao: boolean) {
  if (padrao) {
    await prisma.endereco.updateMany({
      where: { usuarioId, NOT: { id: enderecoId } },
      data: { padrao: false },
    });
    return;
  }
  const total = await prisma.endereco.count({ where: { usuarioId } });
  if (total === 1) {
    await prisma.endereco.update({ where: { id: enderecoId }, data: { padrao: true } });
  }
}

export async function criarEndereco(
  usuarioId: string,
  dados: Omit<Endereco, "id">
): Promise<Endereco> {
  validarEndereco(dados);
  // O corpo pode vir com um `id` provisório gerado no client (ver
  // conta-data.ts); o banco sempre gera o id de verdade.
  const semId: Omit<Endereco, "id"> = { ...(dados as Endereco) };
  delete (semId as Partial<Endereco>).id;
  const criado = await prisma.endereco.create({
    data: { ...semId, complemento: semId.complemento || null, usuarioId },
  });
  await ajustarPadrao(usuarioId, criado.id, dados.padrao);
  const atual = await prisma.endereco.findUniqueOrThrow({ where: { id: criado.id } });
  return paraEndereco(atual);
}

export async function atualizarEndereco(
  usuarioId: string,
  id: string,
  dados: Omit<Endereco, "id">
): Promise<Endereco> {
  validarEndereco(dados);
  const existente = await prisma.endereco.findUnique({ where: { id } });
  if (!existente || existente.usuarioId !== usuarioId) {
    throw new ErroDeNegocio("Endereço não encontrado.", 404);
  }

  const semId: Omit<Endereco, "id"> = { ...(dados as Endereco) };
  delete (semId as Partial<Endereco>).id;
  await prisma.endereco.update({
    where: { id },
    data: { ...semId, complemento: semId.complemento || null },
  });
  await ajustarPadrao(usuarioId, id, dados.padrao);
  const atual = await prisma.endereco.findUniqueOrThrow({ where: { id } });
  return paraEndereco(atual);
}

export async function removerEndereco(usuarioId: string, id: string): Promise<void> {
  const existente = await prisma.endereco.findUnique({ where: { id } });
  if (!existente || existente.usuarioId !== usuarioId) return;

  await prisma.endereco.delete({ where: { id } });

  if (existente.padrao) {
    const proximo = await prisma.endereco.findFirst({
      where: { usuarioId },
      orderBy: { createdAt: "asc" },
    });
    if (proximo) {
      await prisma.endereco.update({ where: { id: proximo.id }, data: { padrao: true } });
    }
  }
}

export async function definirEnderecoPadrao(usuarioId: string, id: string): Promise<void> {
  const existente = await prisma.endereco.findUnique({ where: { id } });
  if (!existente || existente.usuarioId !== usuarioId) {
    throw new ErroDeNegocio("Endereço não encontrado.", 404);
  }
  await prisma.$transaction([
    prisma.endereco.updateMany({ where: { usuarioId }, data: { padrao: false } }),
    prisma.endereco.update({ where: { id }, data: { padrao: true } }),
  ]);
}
