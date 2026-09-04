-- Liga por padrão pra manter o comportamento já em produção (cotação
-- SuperFrete arredondando pro teto da faixa de peso); o admin pode desligar
-- em /admin/configuracoes pra voltar ao peso contínuo.
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "freteAchataFaixaPeso" BOOLEAN NOT NULL DEFAULT true;
