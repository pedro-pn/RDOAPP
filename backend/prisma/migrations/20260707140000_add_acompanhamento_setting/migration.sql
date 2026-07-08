-- Configurações globais do módulo Acompanhamento (chave/valor). Ex.: custo de EPI por colaborador.
CREATE TABLE "AcompanhamentoSetting" (
    "key" TEXT NOT NULL,
    "numberValue" DOUBLE PRECISION,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcompanhamentoSetting_pkey" PRIMARY KEY ("key")
);
