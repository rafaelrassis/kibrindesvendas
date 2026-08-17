import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider } from "@/lib/auth-context";
import { ContaProvider } from "@/lib/conta-context";
import { FavoritosProvider } from "@/lib/favoritos-context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "LeoKibrindes — Presentes personalizados",
  description:
    "Protótipo visual para validação interna do fluxo de compra e personalização da LeoKibrindes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <AuthProvider>
          <ContaProvider>
            <CartProvider>
              <FavoritosProvider>
                <Header />
                <main className="flex-1 pb-16 md:pb-0">{children}</main>
                <Footer />
                <BottomNav />
              </FavoritosProvider>
            </CartProvider>
          </ContaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
