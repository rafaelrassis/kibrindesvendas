ALTER TABLE "EventoFunil" ADD COLUMN "produtoId" TEXT NOT NULL DEFAULT '';
DROP INDEX "EventoFunil_sessao_tipo_dia_key";
CREATE UNIQUE INDEX "EventoFunil_sessao_tipo_dia_produtoId_key" ON "EventoFunil"("sessao", "tipo", "dia", "produtoId");
CREATE INDEX "EventoFunil_produtoId_idx" ON "EventoFunil"("produtoId");
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "funilAtivo" BOOLEAN NOT NULL DEFAULT true;
