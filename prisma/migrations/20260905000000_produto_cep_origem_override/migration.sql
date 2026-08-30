-- CEP de origem por produto (fornecedor terceirizado). null = usa o CEP
-- padrão da loja (ConfiguracaoLoja.cepOrigem).
ALTER TABLE "Produto" ADD COLUMN "cepOrigemOverride" TEXT;
