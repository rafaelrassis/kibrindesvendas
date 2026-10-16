import { NextRequest, NextResponse } from "next/server";
import { getSugestoesCompreJunto } from "@/lib/data/produtos";

// "Compre junto" do carrinho. Catálogo público, sem sessão.
// GET /api/produtos/sugestoes?ids=a,b,c
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  return NextResponse.json(await getSugestoesCompreJunto(ids));
}
