import CarrinhoPageClient from "@/components/CarrinhoPageClient";
import { getConfiguracaoLoja } from "@/lib/data/configuracao";

export default async function CarrinhoPage() {
  const { freteGratisAcimaDe } = await getConfiguracaoLoja();
  return <CarrinhoPageClient freteGratisAcimaDe={freteGratisAcimaDe} />;
}
