-- Campos fiscais da NFSe usados pelo motor de imposto presumido.

ALTER TABLE "OmieReceivable"
ADD COLUMN "aliquotaIss" DECIMAL(5,2),
ADD COLUMN "codigoLc116" TEXT,
ADD COLUMN "codigoServico" TEXT;

