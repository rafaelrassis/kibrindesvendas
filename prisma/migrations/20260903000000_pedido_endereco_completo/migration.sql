-- Endereço congelado no pedido ganha número, complemento e destinatário —
-- até aqui só rua/bairro/cidade/UF eram gravados (via ViaCEP), sem o
-- suficiente pra entregar o pacote de fato.
ALTER TABLE "Pedido"
  ADD COLUMN "enderecoDestinatario" TEXT,
  ADD COLUMN "enderecoNumero" TEXT,
  ADD COLUMN "enderecoComplemento" TEXT;
