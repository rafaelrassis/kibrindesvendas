import { MessageCircle } from "lucide-react";

// Mesmo número do atendimento da personalização (NEXT_PUBLIC_WHATSAPP_LOJA):
// só dígitos, com DDI. Sem ele o botão não aparece — melhor não ter atalho do
// que ter um link wa.me quebrado no site todo.
const WHATSAPP_LOJA = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;
const MENSAGEM = "Olá! Vim do site da LeoKibrindes e gostaria de tirar uma dúvida.";

export default function WhatsAppFloatButton() {
  if (!WHATSAPP_LOJA) return null;

  const href = `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(MENSAGEM)}`;

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
