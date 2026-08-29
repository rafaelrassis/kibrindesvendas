import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { usuarioIdDaSessao } from "@/lib/session";

export type UsuarioPublico = {
  id: string;
  nome: string;
  email: string;
  admin: boolean;
};

function paraPublico(u: {
  id: string;
  nome: string;
  email: string;
  admin: boolean;
}): UsuarioPublico {
  return { id: u.id, nome: u.nome, email: u.email, admin: u.admin };
}

export async function registrarUsuario(
  nome: string,
  email: string,
  senha: string,
  cpf: string,
  telefone: string
) {
  const existenteEmail = await prisma.usuario.findUnique({ where: { email } });
  if (existenteEmail) throw new Error("Já existe uma conta com este e-mail.");

  const existenteCpf = await prisma.usuario.findUnique({ where: { cpf } });
  if (existenteCpf) throw new Error("Já existe uma conta com este CPF.");

  const senhaHash = await bcrypt.hash(senha, 10);
  const usuario = await prisma.usuario.create({
    data: { nome, email, cpf, telefone, senhaHash },
  });
  return paraPublico(usuario);
}

export async function autenticarUsuario(email: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) return null;

  const ok = await bcrypt.compare(senha, usuario.senhaHash);
  return ok ? paraPublico(usuario) : null;
}

export async function getUsuarioPublico(id: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  return usuario ? paraPublico(usuario) : null;
}

export async function getUsuarioDaSessao(): Promise<UsuarioPublico | null> {
  const id = await usuarioIdDaSessao();
  return id ? getUsuarioPublico(id) : null;
}

export async function trocarSenha(id: string, senhaAtual: string, novaSenha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new Error("Usuário não encontrado.");

  const ok = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!ok) throw new Error("Senha atual incorreta.");

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuario.update({ where: { id }, data: { senhaHash } });
}

// Usada pelo fluxo "esqueci minha senha": o token já prova identidade (ver
// session.ts), então não pede a senha atual como trocarSenha() pede.
export async function redefinirSenhaComToken(usuarioId: string, novaSenha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new Error("Usuário não encontrado.");

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuario.update({ where: { id: usuarioId }, data: { senhaHash } });
}

export async function trocarEmail(id: string, senhaAtual: string, novoEmail: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new Error("Usuário não encontrado.");

  const ok = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!ok) throw new Error("Senha atual incorreta.");

  if (novoEmail === usuario.email) return paraPublico(usuario);

  const existente = await prisma.usuario.findUnique({ where: { email: novoEmail } });
  if (existente) throw new Error("Já existe uma conta com este e-mail.");

  const atualizado = await prisma.usuario.update({
    where: { id },
    data: { email: novoEmail },
  });
  return paraPublico(atualizado);
}
