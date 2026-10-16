ALTER TABLE "LembreteCarrinho" ADD COLUMN "motivo" TEXT;

CREATE TABLE "EventoFunil" (
    "id" TEXT NOT NULL,
    "sessao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoFunil_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventoFunil_sessao_tipo_dia_key" ON "EventoFunil"("sessao", "tipo", "dia");
CREATE INDEX "EventoFunil_criadoEm_idx" ON "EventoFunil"("criadoEm");
