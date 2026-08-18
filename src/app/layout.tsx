import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider } from "@/lib/auth-context";
import { ContaProvider } from "@/lib/conta-context";
import { FavoritosProvider } from "@/lib/favoritos-context";
import { NotificacoesProvider } from "@/lib/notificacoes-context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppFloatButton from "@/components/WhatsAppFloatButton";
import { getCategorias } from "@/lib/data/categorias";

export const metadata: Metadata = {
  title: "LeoKibrindes — Presentes personalizados",
  description:
    "Protótipo visual para validação interna do fluxo de compra e personalização da LeoKibrindes.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const categorias = await getCategorias();

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <AuthProvider>
          <ContaProvider>
            <CartProvider>
              <FavoritosProvider>
                <NotificacoesProvider>
                  <Header categorias={categorias} />
                  <main className="flex-1 pb-16 md:pb-0">{children}</main>
                  <Footer />
                  <BottomNav />
                  <WhatsAppFloatButton />
                </NotificacoesProvider>
              </FavoritosProvider>
            </CartProvider>
          </ContaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
