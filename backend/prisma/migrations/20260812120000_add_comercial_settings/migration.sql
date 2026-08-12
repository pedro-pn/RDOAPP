-- Configuração do módulo Comercial (T131).
--
-- Tira o endereço da sede do `.env`. Ele é dado de negócio: muda quando a
-- empresa muda de prédio, quem sabe o endereço novo é o gestor, e até aqui
-- trocá-lo exigia editar arquivo no servidor e reiniciar o container.
--
-- Linha única, criada vazia. Vazio significa "cálculo automático de distância
-- indisponível", que é resposta que a tela já sabe dar — e é melhor que semear
-- um endereço no SQL, porque endereço semeado em migration ninguém revisa e
-- ninguém sabe de onde veio.

-- CreateTable
CREATE TABLE "comercial"."ComercialSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "sedeAddress" TEXT NOT NULL DEFAULT '',
    "sedeFormattedAddress" TEXT,
    "sedePlaceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,
    "updatedByLabel" TEXT,

    CONSTRAINT "ComercialSettings_pkey" PRIMARY KEY ("id")
);
