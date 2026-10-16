import { NextRequest, NextResponse } from "next/server";
import { salvarCarrinhoVisitante } from "@/lib/data/carrinho-visitante";
import { corpoJson, respostaDeErro } from "@/lib/api";
import { checarLimite, ipDaRequisicao } from "@/lib/rate-limit";

const LIMITE = 5;
const JANELA_SEGUNDOS = 60 * 60;

// Visitante guarda o carrinho com o e-mail (sem criar conta).
export async function POST(req: NextRequest) {
  const ip = ipDaRequisicao(req.headers);
  const limite = await checarLimite(`carrinho-visitante:${ip}`, LIMITE, JANELA_SEGUNDOS);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente de novo mais tarde." },
      { status: 429, headers: { "Retry-After": String(limite.espereSegundos) } }
    );
  }

  try {
    const { email, itens, consentimento, telefone } = await corpoJson<{
      email?: unknown;
      itens?: unknown;
      consentimento?: unknown;
      telefone?: unknown;
    }>(req);
    await salvarCarrinhoVisitante(email, itens, consentimento, telefone);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
