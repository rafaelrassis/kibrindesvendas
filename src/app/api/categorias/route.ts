import { NextResponse } from "next/server";
import { getCategorias } from "@/lib/data/categorias";

export async function GET() {
  return NextResponse.json(await getCategorias());
}
