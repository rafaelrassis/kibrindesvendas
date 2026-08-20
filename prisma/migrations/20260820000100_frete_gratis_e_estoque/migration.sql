-- AlterTable (ConfiguracaoLoja)
-- null = regra desligada; a loja nasce sem frete grátis automático.
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "freteGratisAcimaDe" DECIMAL(10,2);

-- AlterTable (Produto)
-- null = estoque não controlado — todo produto já cadastrado continua vendendo
-- sem limite até o admin preencher um número.
ALTER TABLE "Produto" ADD COLUMN "estoque" INTEGER;

-- AlterTable (Pedido)
-- Pedidos antigos nunca tiveram frete grátis — default false preserva o
-- histórico como estava.
ALTER TABLE "Pedido" ADD COLUMN "freteGratis" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Produto"
  ADD CONSTRAINT "produto_estoque_nao_negativo" CHECK ("estoque" IS NULL OR "estoque" >= 0);

ALTER TABLE "ConfiguracaoLoja"
  ADD CONSTRAINT "config_frete_gratis_nao_negativo" CHECK ("freteGratisAcimaDe" IS NULL OR "freteGratisAcimaDe" >= 0);

-- A trava antiga (ver 20260818230000_travas_cupom) exigia valor > 0 pra todo
-- cupom. Cupom de frete grátis não usa o campo `valor` (fica em 0) — a trava
-- passa a exigir > 0 só quando o tipo realmente depende dele.
ALTER TABLE "Cupom" DROP CONSTRAINT "cupom_valor_positivo";
ALTER TABLE "Cupom"
  ADD CONSTRAINT "cupom_valor_positivo" CHECK (
    "tipo" = 'FRETE_GRATIS' OR "valor" > 0
  );
