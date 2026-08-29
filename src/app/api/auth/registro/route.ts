import { NextRequest, NextResponse } from "next/server";
import { registrarUsuario } from "@/lib/data/usuarios";
import { criarSessao } from "@/lib/session";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { apenasDigitos, cpfValido } from "@/lib/cpf";

export async function POST(req: NextRequest) {
  let nome: string | undefined;
  let email: string | undefined;
  let senha: string | undefined;
  let cpf: string | undefined;
  let telefone: string | undefined;
  try {
    ({ nome, email, senha, cpf, telefone } = await corpoJson<{
      nome?: string;
      email?: string;
      senha?: string;
      cpf?: string;
      telefone?: string;
    }>(req));
  } catch (e) {
    return respostaDeErro(e);
  }

  if (!nome?.trim() || !email?.trim() || !senha || !cpf?.trim() || !telefone?.trim()) {
    return NextResponse.json(
      { error: "Preencha nome, e-mail, telefone, CPF e senha." },
      { status: 400 }
    );
  }
  if (senha.length < 6) {
    return NextResponse.json(
      { error: "A senha precisa ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }
  if (!cpfValido(cpf)) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }

  try {
    const usuario = await registrarUsuario(
      nome.trim(),
      email.trim().toLowerCase(),
      senha,
      apenasDigitos(cpf),
      telefone.trim()
    );
    await criarSessao(usuario.id);
    return NextResponse.json(usuario);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível criar a conta." },
      { status: 409 }
    );
  }
}
