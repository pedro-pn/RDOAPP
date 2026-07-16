# Checklist: Requisitos — DDS no RDO

- [X] CHK001 Toggle "Houve DDS?" presente no turno diurno e (quando ligado o noturno) no turno noturno (FR-001)
- [X] CHK002 Toggle ligado revela Início/Término + select de temas ativos, input de tema livre e chips removíveis (FR-002)
- [X] CHK003 Validação: início, término e ≥1 tema obrigatórios com toggle ligado; nada exigido com toggle desligado (FR-003)
- [X] CHK004 Relatório grava snapshot `{id, name, custom?}` por turno em `specialConditions.dds` (FR-004)
- [X] CHK005 Draft persiste e restaura DDS completo (FR-005)
- [X] CHK006 Edição pelo gestor altera DDS com mesmas validações; visualização exibe DDS por turno (FR-006)
- [X] CHK007 CRUD de temas: leitura interna, escrita manager+coordinator, soft delete (FR-007); colaborador/cliente → 403 (SC-004)
- [X] CHK008 UI de gestão no GestorPage (sub-aba Equipe) e CoordinatorPage (aba), pt-BR, mobile (FR-008)
- [X] CHK009 DOCX com seção DDS dedicada; sem DDS → campos em branco sem tokens residuais (FR-009)
- [X] CHK010 RDOs antigos sem `dds` funcionam em formulário, visualização, edição e documento (FR-010, SC-003)
- [X] CHK011 DDS noturno gravado como desabilitado quando turno noturno é desligado (edge case)
- [X] CHK012 `npm test` backend verde com `report-dds.test.js` (SC-005)
