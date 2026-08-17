import { NextRequest, NextResponse } from "next/server";
import { autenticarUsuario } from "@/lib/data/usuarios";
import { criarSessao } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json();

  if (!email?.trim() || !senha) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  const usuario = await autenticarUsuario(email.trim().toLowerCase(), senha);
  if (!usuario) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  await criarSessao(usuario.id);
  return NextResponse.json(usuario);
}
