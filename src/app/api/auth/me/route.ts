import { NextResponse } from "next/server";
import { usuarioIdDaSessao } from "@/lib/session";
import { getUsuarioPublico } from "@/lib/data/usuarios";

export async function GET() {
  const id = await usuarioIdDaSessao();
  if (!id) return NextResponse.json(null);

  const usuario = await getUsuarioPublico(id);
  return NextResponse.json(usuario);
}
