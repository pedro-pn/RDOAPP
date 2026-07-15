-- Lista gerenciável de temas de DDS (Diálogo Diário de Segurança) dos RDOs

CREATE TABLE "DdsTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DdsTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DdsTheme_name_key" ON "DdsTheme"("name");
CREATE INDEX "DdsTheme_isActive_order_idx" ON "DdsTheme"("isActive", "order");

-- Carga inicial de temas comuns (gestores/coordenadores podem renomear/desativar)
INSERT INTO "DdsTheme" ("id", "name", "order", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Uso correto de EPI', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Sinalização de segurança', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Prevenção de quedas e escorregões', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Postura correta ao carregar e levantar peso', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Prevenção de incêndios e uso do extintor', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Organização e limpeza (5S) como aliados da segurança', 6, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Rota de fuga: conheça o caminho', 7, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'O perigo do improviso em equipamentos', 8, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Excesso de confiança = risco', 9, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Segurança coletiva', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'APR análise prevencionista de risco', 11, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Cuidados com o manuseio de produtos químicos', 12, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Reportar quase acidentes e sua importância', 13, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Cuidados com a higiene pessoal', 14, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Uso obrigatório de crachá', 15, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Cuidados com o meio ambiente', 16, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Incidentes e acidentes', 17, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Capacitação para operar equipamentos', 18, CURRENT_TIMESTAMP)

ON CONFLICT ("name") DO NOTHING;
