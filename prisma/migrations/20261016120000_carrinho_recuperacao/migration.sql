-- Recuperação de carrinho: segundo lembrete com cupom, histórico de lembretes,
-- carrinho de visitante por e-mail e as chaves de liga/desliga na configuração.
ALTER TABLE "Usuario" ADD COLUMN "carrinhoLembrete2Em" TIMESTAMP(3);

ALTER TABLE "ConfiguracaoLoja"
  ADD COLUMN "lembreteCarrinhoAtivo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cupomCarrinhoAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cupomCarrinhoPercentual" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "cupomCarrinhoValidadeDias" INTEGER NOT NULL DEFAULT 7;

CREATE TABLE "LembreteCarrinho" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" INTEGER NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorCarrinho" DECIMAL(10,2) NOT NULL,
    "cupomCodigo" TEXT,
    CONSTRAINT "LembreteCarrinho_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LembreteCarrinho_enviadoEm_idx" ON "LembreteCarrinho"("enviadoEm");
CREATE INDEX "LembreteCarrinho_usuarioId_idx" ON "LembreteCarrinho"("usuarioId");
ALTER TABLE "LembreteCarrinho" ADD CONSTRAINT "LembreteCarrinho_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CarrinhoVisitante" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "itens" JSONB NOT NULL,
    "valorCarrinho" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lembreteEm" TIMESTAMP(3),
    "restauradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CarrinhoVisitante_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CarrinhoVisitante_email_key" ON "CarrinhoVisitante"("email");
CREATE UNIQUE INDEX "CarrinhoVisitante_token_key" ON "CarrinhoVisitante"("token");
