import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { criarBanner, getBanners, reordenarBanners } from "@/lib/data/banners";
import { bloqueioAdmin } from "@/lib/admin";
import { corpoJson, respostaDeErro } from "@/lib/api";

export async function GET() {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  return NextResponse.json(await getBanners());
}

export async function POST(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const banner = await criarBanner(await corpoJson(req));
    revalidatePath("/");
    return NextResponse.json(banner);
  } catch (e) {
    return respostaDeErro(e);
  }
}

// Reordenar é do carrossel inteiro, não de um banner: a tela manda a lista de
// ids na ordem nova e o servidor renumera todos de uma vez.
export async function PUT(req: NextRequest) {
  const bloqueio = await bloqueioAdmin();
  if (bloqueio) return bloqueio;

  try {
    const { ids } = await corpoJson<{ ids?: unknown }>(req);
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "Informe a ordem dos banners." }, { status: 400 });
    }

    await reordenarBanners(ids as string[]);
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
