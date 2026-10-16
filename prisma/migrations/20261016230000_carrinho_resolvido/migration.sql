CREATE TABLE "ResolvidoCarrinho" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "email" TEXT,
    "resolvidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolvidoCarrinho_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResolvidoCarrinho_usuarioId_idx" ON "ResolvidoCarrinho"("usuarioId");
CREATE INDEX "ResolvidoCarrinho_email_idx" ON "ResolvidoCarrinho"("email");
