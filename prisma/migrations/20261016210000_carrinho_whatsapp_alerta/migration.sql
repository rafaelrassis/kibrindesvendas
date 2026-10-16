ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "whatsappModelo" TEXT,
ADD COLUMN "abAlertado" TEXT;

CREATE TABLE "ContatoCarrinho" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "email" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContatoCarrinho_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContatoCarrinho_criadoEm_idx" ON "ContatoCarrinho"("criadoEm");
