-- Marcador de "já viu o tutorial" do módulo Comercial (FR-025a, T096).
--
-- Por usuário e no servidor. Em `localStorage`, dois usuários da mesma máquina
-- compartilhariam o marcador e o mesmo usuário veria o tutorial de novo em
-- outro computador — o tutorial acompanha a pessoa, não o dispositivo.
--
-- Sem FK para `public.User` de propósito: o registro é um evento sobre uma
-- conta, e conta apagada não precisa deixar o marcador para trás. As demais FKs
-- entre schemas do módulo existem porque apontam para dado de negócio.

CREATE TABLE "comercial"."ComercialTutorialSeen" (
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComercialTutorialSeen_pkey" PRIMARY KEY ("userId")
);
