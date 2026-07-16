# Quickstart: validação da feature DDS no RDO

## Preparação (dev)

```bash
cd backend && npx prisma migrate dev   # aplica add_dds_theme
npm run dev                            # backend
cd ../frontend && npm run dev          # frontend
```

Produção/staging (rode no servidor, conforme deploy/):

```bash
npx prisma migrate deploy
```

## Roteiro de validação

1. **Temas (coordenador)** — logar como coordenador → aba "Temas de DDS" → criar "Uso correto de EPI", "Trabalho em altura", "Içamento de cargas". Renomear um, desativar outro e conferir que o desativado permanece listado como inativo (com `all`).
2. **Temas (gestor)** — logar como gestor → Equipe → sub-aba "Temas de DDS" → mesmo CRUD funcionando.
3. **Permissão** — como colaborador, `POST /rdo/dds-themes` direto na API → 403.
4. **Novo RDO com DDS** — como colaborador: ligar "Houve DDS?" (diurno), preencher 07:00–07:15 e adicionar 2 temas (tema desativado não aparece no select); adicionar também um tema livre pelo input quando necessário; ligar turno noturno e o DDS noturno com 1 tema. Tentar avançar sem tema/horário → validação bloqueia.
5. **Draft** — no meio do preenchimento, sair; retomar o rascunho na Home e conferir toggles, horários e chips restaurados.
6. **DDS noturno órfão** — preencher DDS noturno, desligar o turno noturno, enviar; conferir no detalhe que só o DDS diurno aparece.
7. **Visualização/edição (gestor)** — abrir o RDO: card DDS por turno na visualização; editar, trocar temas, cadastrar na lista oficial qualquer tema livre pendente, desligar o DDS diurno, salvar e conferir round-trip (bloco antigo não ressuscita).
8. **Documento** — baixar DOCX/PDF: seção "DDS — DIÁLOGO DIÁRIO DE SEGURANÇA" com horários e temas por turno. Gerar também de um RDO **antigo** (sem dds): seção em branco, nenhum `{{token}}` residual.
9. **Testes** — `cd backend && npm test` (inclui `report-dds.test.js`); `cd frontend && npm test && npm run build`.
