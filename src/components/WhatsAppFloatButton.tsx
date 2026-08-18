import { MessageCircle } from "lucide-react";

// TODO: substituir pelo número real de atendimento (formato: 55DDDNUMERO)
const WHATSAPP_NUMERO = "5511999999999";
const WHATSAPP_MENSAGEM = "Olá! Vim do site da LeoKibrindes e gostaria de tirar uma dúvida.";

export default function WhatsAppFloatButton() {
  const href = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MENSAGEM)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105 transition-transform"
    >
      <MessageCircle size={28} fill="white" className="text-[#25D366]" aria-hidden="true" />
    </a>
  );
}
