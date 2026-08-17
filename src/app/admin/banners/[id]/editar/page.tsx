import { notFound } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import AdminBannerForm from "@/components/AdminBannerForm";
import { getBanner } from "@/lib/data/banners";
import { exigirAdmin } from "@/lib/admin";

export default async function EditarBannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdmin();

  const { id } = await params;
  const banner = await getBanner(id);
  if (!banner) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl mb-1">Editar banner</h1>
      <p className="text-ink/60 mb-2 text-sm">{banner.titulo}</p>
      <AdminNav />
      <AdminBannerForm banner={banner} />
    </div>
  );
}
