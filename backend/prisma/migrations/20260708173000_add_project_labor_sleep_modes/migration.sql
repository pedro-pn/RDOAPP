-- Preferência de hospedagem por colaborador no Acompanhamento.
-- Mapa JSON: collaboratorId -> HOME/AWAY para RDOs de projetos não-offshore.
ALTER TABLE "Project" ADD COLUMN "laborSleepModeByCollaborator" JSONB NOT NULL DEFAULT '{}';
