-- Preço visto ao adicionar ao carrinho (aviso de preço alterado) e controle do
-- lembrete de carrinho esquecido.
ALTER TABLE "CarrinhoItem" ADD COLUMN "precoAdicionado" DECIMAL(10,2);
ALTER TABLE "Usuario" ADD COLUMN "carrinhoLembreteEm" TIMESTAMP(3);
