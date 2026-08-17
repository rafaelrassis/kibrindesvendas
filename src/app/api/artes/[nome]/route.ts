import { NextRequest, NextResponse } from "next/server";
import { usuarioIdDaSessao } from "@/lib/session";
import { lerArte, nomeDeArteValido, tipoDaArte } from "@/lib/artes";

// Arte de cliente não fica em URL pública: pede sessão. A loja abre pela fila
// em /admin/pedidos, o cliente pelo próprio pedido.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ nome: string }> }) {
  const usuarioId = await usuarioIdDaSessao();
  if (!usuarioId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { nome } = await params;
  if (!nomeDeArteValido(nome)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const conteudo = await lerArte(nome);
  if (!conteudo) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  return new NextResponse(conteudo, {
    headers: {
      "Content-Type": tipoDaArte(nome),
      "Content-Disposition": `inline; filename="${nome}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
