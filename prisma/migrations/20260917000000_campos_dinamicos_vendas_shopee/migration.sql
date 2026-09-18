-- Campos dinâmicos de "Vendas Shopee": troca os 3 % fixos por um template
-- editável (nome, tipo, sinal, valorPadrao) em ConfiguracaoLoja, e cada
-- VendaShopee passa a guardar o snapshot inteiro em vez de 3 decimais fixos.
-- Override por produto (Produto.shopeeComissaoPct e cia) foi removido.

ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "camposMargemShopee" JSONB;

-- Preserva os defaults já configurados como campos iniciais do template.
UPDATE "ConfiguracaoLoja"
SET "camposMargemShopee" = (
  SELECT jsonb_agg(campo) FROM (
    SELECT jsonb_build_object(
      'nome', 'Comissão %', 'tipo', 'percentual', 'sinal', 'subtrai',
      'valorPadrao', "shopeeComissaoPct"
    ) AS campo WHERE "shopeeComissaoPct" IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object(
      'nome', 'Frete %', 'tipo', 'percentual', 'sinal', 'subtrai',
      'valorPadrao', "shopeeFretePct"
    ) WHERE "shopeeFretePct" IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object(
      'nome', 'Ads %', 'tipo', 'percentual', 'sinal', 'subtrai',
      'valorPadrao', "shopeeAdsPct"
    ) WHERE "shopeeAdsPct" IS NOT NULL
  ) t
)
WHERE "shopeeComissaoPct" IS NOT NULL
   OR "shopeeFretePct" IS NOT NULL
   OR "shopeeAdsPct" IS NOT NULL;

ALTER TABLE "ConfiguracaoLoja"
  DROP COLUMN "shopeeComissaoPct",
  DROP COLUMN "shopeeFretePct",
  DROP COLUMN "shopeeAdsPct";

-- Override por produto removido: sem esse dado, produto nunca teve uso
-- próprio além de sobrescrever o default global (já migrado acima).
ALTER TABLE "Produto"
  DROP COLUMN "shopeeComissaoPct",
  DROP COLUMN "shopeeFretePct",
  DROP COLUMN "shopeeAdsPct";

-- Cada venda já lançada guarda snapshot equivalente ao que tinha antes.
ALTER TABLE "VendaShopee" ADD COLUMN "valoresShopee" JSONB;

UPDATE "VendaShopee"
SET "valoresShopee" = jsonb_build_array(
  jsonb_build_object(
    'nome', 'Comissão %', 'tipo', 'percentual', 'sinal', 'subtrai',
    'valor', "comissaoPct"
  ),
  jsonb_build_object(
    'nome', 'Frete %', 'tipo', 'percentual', 'sinal', 'subtrai',
    'valor', "fretePct"
  ),
  jsonb_build_object(
    'nome', 'Ads %', 'tipo', 'percentual', 'sinal', 'subtrai',
    'valor', "adsPct"
  )
);

ALTER TABLE "VendaShopee" ALTER COLUMN "valoresShopee" SET NOT NULL;

ALTER TABLE "VendaShopee"
  DROP COLUMN "comissaoPct",
  DROP COLUMN "fretePct",
  DROP COLUMN "adsPct";
