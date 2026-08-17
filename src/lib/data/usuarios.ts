import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type UsuarioPublico = { id: string; nome: string; email: string };

function paraPublico(u: { id: string; nome: string; email: string }): UsuarioPublico {
  return { id: u.id, nome: u.nome, email: u.email };
}

export async function registrarUsuario(nome: string, email: string, senha: string) {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) throw new Error("Já existe uma conta com este e-mail.");

  const senhaHash = await bcrypt.hash(senha, 10);
  const usuario = await prisma.usuario.create({
    data: { nome, email, senhaHash },
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

export async function trocarSenha(id: string, senhaAtual: string, novaSenha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new Error("Usuário não encontrado.");

  const ok = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!ok) throw new Error("Senha atual incorreta.");

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuario.update({ where: { id }, data: { senhaHash } });
}
