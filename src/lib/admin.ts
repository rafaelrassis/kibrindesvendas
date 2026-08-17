import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getUsuarioDaSessao } from "@/lib/data/usuarios";
import { ErroDeNegocio } from "@/lib/data/erros";

// Guarda das telas /admin. Precisa ser chamada dentro da própria página, antes
// de qualquer query: barrar só no layout esconde o resultado da tela, mas a
// página roda de todo jeito e o que ela renderizou vai junto no payload da
// resposta.
export async function exigirAdmin() {
  const usuario = await getUsuarioDaSessao();
  if (!usuario) redirect("/entrar?next=/admin/produtos");
  if (!usuario.admin) redirect("/restrito");
  return usuario;
}

// Guarda das rotas /api/admin: devolve a resposta de erro quando a sessão não
// é de um admin, ou null quando pode seguir.
export async function bloqueioAdmin(): Promise<NextResponse | null> {
  const usuario = await getUsuarioDaSessao();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!usuario.admin) {
    return NextResponse.json(
      { error: "Acesso restrito à equipe da loja." },
      { status: 403 }
    );
  }
  return null;
}

// Traduz os erros esperados da camada de dados pro JSON das rotas; o resto
// sobe e vira 500, que é o certo pra falha inesperada.
export function respostaDeErro(e: unknown) {
  if (e instanceof ErroDeNegocio) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  throw e;
}
