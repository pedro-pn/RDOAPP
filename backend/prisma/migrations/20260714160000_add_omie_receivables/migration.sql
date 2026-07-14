-- Integração Omie: contas a receber/faturamento por projeto

CREATE TABLE "OmieReceivable" (
    "id" TEXT NOT NULL,
    "omieId" TEXT NOT NULL,
    "codigoProjeto" TEXT,
    "projectId" TEXT,
    "osNumber" TEXT,
    "valor" DECIMAL(14,2),
    "valorIss" DECIMAL(14,2),
    "statusTitulo" TEXT,
    "categoriaCodigo" TEXT,
    "categoriaDescricao" TEXT,
    "clienteCodigo" TEXT,
    "numeroDocumento" TEXT,
    "numeroDocumentoFiscal" TEXT,
    "numeroPedido" TEXT,
    "codigoTipoDocumento" TEXT,
    "origem" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "dataVencimento" TIMESTAMP(3),
    "dataPrevisao" TIMESTAMP(3),
    "dataRegistro" TIMESTAMP(3),
    "retemIss" BOOLEAN,
    "retemPis" BOOLEAN,
    "retemCofins" BOOLEAN,
    "retemCsll" BOOLEAN,
    "retemIr" BOOLEAN,
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmieReceivable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OmieReceivable_omieId_key" ON "OmieReceivable"("omieId");
CREATE INDEX "OmieReceivable_projectId_idx" ON "OmieReceivable"("projectId");
CREATE INDEX "OmieReceivable_codigoProjeto_idx" ON "OmieReceivable"("codigoProjeto");
CREATE INDEX "OmieReceivable_codigoTipoDocumento_idx" ON "OmieReceivable"("codigoTipoDocumento");
CREATE INDEX "OmieReceivable_statusTitulo_idx" ON "OmieReceivable"("statusTitulo");
CREATE INDEX "OmieReceivable_dataEmissao_idx" ON "OmieReceivable"("dataEmissao");

ALTER TABLE "OmieReceivable" ADD CONSTRAINT "OmieReceivable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
