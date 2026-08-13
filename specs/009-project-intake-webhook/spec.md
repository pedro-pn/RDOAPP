# Feature Specification: Recebimento de projetos por webhook

**Feature Branch**: `feat/project-intake-webhook`

**Created**: 2026-08-13

**Status**: Implemented

**Input**: User description: "Receber por webhook o número, nome, cliente, CNPJ, contrato e local de um projeto criado em outro aplicativo; criar o projeto no NewRDO destacado e com notificação para verificação manual."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receber projeto externo sem duplicidade (Priority: P1)

Um sistema externo autorizado envia os dados de um projeto recém-criado. O NewRDO valida os dados, cria exatamente um projeto e informa ao remetente que o recebimento foi concluído.

**Why this priority**: Sem a entrada automatizada e confiável do projeto, todo o restante do fluxo continua dependendo de cadastro manual e sujeito a digitação duplicada.

**Independent Test**: Enviar um projeto válido com credencial de serviço e confirmar que ele é criado uma única vez com os seis dados recebidos e estado de revisão pendente.

**Acceptance Scenarios**:

1. **Given** uma integração autorizada e um número de projeto ainda inexistente, **When** ela envia número, nome, cliente, CNPJ, contrato e local válidos, **Then** um único projeto ativo é criado com esses dados e marcado para revisão manual.
2. **Given** um projeto já recebido e ainda pendente, **When** a integração repete exatamente o mesmo envio, **Then** nenhuma duplicata é criada e o remetente recebe uma resposta de sucesso idempotente.
3. **Given** uma credencial ausente ou inválida, **When** o envio é realizado, **Then** o projeto não é criado e o remetente recebe uma resposta de não autorização.

---

### User Story 2 - Identificar e revisar projetos importados (Priority: P1)

Um gestor acessa a área de projetos e percebe imediatamente que existem cadastros recebidos da integração aguardando conferência. Ele abre o cadastro destacado, revisa os campos e confirma ou exclui o projeto.

**Why this priority**: A automação não pode liberar silenciosamente dados externos para operação; a conferência humana é a barreira de qualidade solicitada.

**Independent Test**: Criar um projeto pela integração, entrar como gestor e confirmar que há contador, aviso, destaque visual e uma ação clara para revisar e confirmar o cadastro.

**Acceptance Scenarios**:

1. **Given** ao menos um projeto recebido e não verificado, **When** o gestor abre seu painel, **Then** a aba de projetos exibe uma notificação quantitativa de pendências.
2. **Given** projetos recebidos e não verificados, **When** o gestor abre a aba Projetos, **Then** eles aparecem antes dos projetos normais, em bloco e cartões destacados, com mensagem que identifica a origem automática e solicita revisão.
3. **Given** um projeto pendente com dados válidos, **When** o gestor revisa e salva o cadastro, **Then** a pendência é encerrada, o destaque desaparece e o projeto passa ao fluxo operacional normal.
4. **Given** um projeto recebido indevidamente, **When** o gestor o exclui, **Then** ele deixa de aparecer como pendência e não fica disponível para uso operacional.

---

### User Story 3 - Corrigir envios inválidos ou conflitantes (Priority: P2)

O sistema remetente recebe respostas claras quando faltam dados, o CNPJ é inválido ou o número já pertence a outro projeto com informações diferentes.

**Why this priority**: Respostas determinísticas permitem corrigir a integração sem sobrescrever cadastros existentes nem exigir investigação manual no banco.

**Independent Test**: Enviar cargas incompletas, CNPJ inválido e número já existente com dados diferentes, confirmando que nenhum cadastro é criado ou alterado e que cada resposta identifica a causa.

**Acceptance Scenarios**:

1. **Given** um envio sem qualquer um dos seis campos obrigatórios, **When** ele é processado, **Then** nenhum projeto é criado e a resposta identifica os campos inválidos.
2. **Given** um CNPJ que não contenha 14 dígitos após normalização, **When** ele é enviado, **Then** nenhum projeto é criado e a resposta informa que o CNPJ é inválido.
3. **Given** um número já usado por projeto com dados diferentes, **When** a integração tenta reutilizá-lo, **Then** o cadastro existente permanece intacto e a resposta informa o conflito.

### Edge Cases

- Espaços ao redor dos campos são removidos antes da comparação e persistência.
- Pontuação do CNPJ é aceita, mas o valor é normalizado para 14 dígitos.
- O número do projeto é tratado como identificador textual para preservar zeros à esquerda.
- Dois envios simultâneos do mesmo projeto resultam em um único cadastro.
- Um reenvio idêntico não reabre a revisão de um projeto que já foi conferido.
- Um número pertencente a registro ainda existente, inclusive arquivado ou excluído logicamente, continua reservado e gera conflito em vez de criar um segundo cadastro.
- Falhas internas não devem retornar segredos, detalhes do banco ou rastros de execução ao remetente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar um canal de recebimento sistema-a-sistema para um único projeto por solicitação.
- **FR-002**: O sistema MUST exigir uma credencial de serviço exclusiva da integração e MUST rejeitar solicitações sem credencial ou com credencial inválida.
- **FR-003**: O sistema MUST recusar o recebimento quando a credencial da integração não estiver configurada no ambiente.
- **FR-004**: Cada envio MUST conter número do projeto, nome do projeto, cliente, CNPJ, contrato e local como textos não vazios.
- **FR-005**: O sistema MUST normalizar espaços e CNPJ antes de validar, comparar e armazenar os dados.
- **FR-006**: O sistema MUST aceitar CNPJ com ou sem pontuação e MUST exigir exatamente 14 dígitos após normalização.
- **FR-007**: Um envio válido para um número inexistente MUST criar um projeto ativo com os dados recebidos, defaults operacionais seguros e estado de revisão manual pendente.
- **FR-008**: Enquanto estiver pendente, o projeto MUST NOT provisionar contas de cliente nem ficar disponível para criação de relatórios.
- **FR-009**: Repetir um envio com o mesmo número e os mesmos seis dados normalizados MUST ser idempotente, MUST NOT criar duplicata e MUST NOT reabrir uma revisão já concluída.
- **FR-010**: Um envio cujo número já exista com qualquer um dos seis dados diferente MUST ser rejeitado como conflito e MUST NOT alterar o cadastro existente.
- **FR-011**: A resposta de sucesso MUST indicar se o projeto foi criado agora ou se o envio era uma repetição idempotente, além de identificar o projeto resultante.
- **FR-012**: Respostas de erro MUST distinguir ao menos credencial inválida, configuração ausente, dados inválidos e conflito de número.
- **FR-013**: Gestores MUST ver a quantidade de projetos pendentes junto à navegação da área de Projetos.
- **FR-014**: Projetos pendentes MUST aparecer antes dos projetos normais em uma seção destacada, com cartão visualmente diferenciado e aviso em português solicitando conferência manual.
- **FR-015**: O aviso MUST identificar explicitamente projetos recebidos pelo webhook e MUST preservar a identificação de projetos pendentes criados pelo Romaneio.
- **FR-016**: O gestor MUST poder abrir a edição diretamente a partir do cartão pendente e confirmar a revisão ao salvar os dados obrigatórios válidos.
- **FR-017**: Depois da confirmação manual, o sistema MUST remover o estado pendente, retirar a notificação e liberar o projeto para o fluxo operacional conforme sua configuração de visibilidade.
- **FR-018**: Excluir um projeto pendente MUST remover sua notificação e impedir seu uso operacional.
- **FR-019**: A criação, a repetição idempotente e a resolução da pendência MUST invalidar as listagens afetadas para que o estado exibido seja atualizado sem inconsistência persistente.
- **FR-020**: A nova função visível MUST exibir, para gestores, um aviso de novidade com tutorial inicial durante a campanha global de 10 dias iniciada em 2026-08-13 e encerrada em 2026-08-23, registrando a visualização por usuário e navegador.

### Visual/UI Contract *(mandatory if feature touches frontend)*

| Surface | Existing reference inspected | Components/classes to use | Form/dropdown pattern | Reorder drag/drop pattern | Navigation persistence | Novelty/tutorial contract | Responsive/overflow contract |
|---------|------------------------------|---------------------------|-----------------------|---------------------------|------------------------|---------------------------|------------------------------|
| Aba Projetos do gestor | `frontend/src/pages/gestor/GestorPage.tsx`, bloco atual de cadastro pendente | `nav-tab-count`, `project-registration-fixed-block`, `project-registration-alert`, `card admin-card project-admin-card`, badges existentes | Edição inline existente com `field-group`; campos inválidos devem usar `field-invalid`, `aria-invalid` e `field-error` | N/A | Aba mantida em `?tab=projetos`; o projeto aberto segue o padrão atual de detalhes/edição | Card centralizado em Driver.js para gestores, marcador por usuário/navegador, expiração global em 2026-08-23 e um passo guiado apontando contador/bloco de revisão | Bloco e cartões empilham em telas estreitas; títulos, badges e ações quebram linha sem scroll horizontal da página |

### Key Entities *(include if feature involves data)*

- **Projeto**: Cadastro operacional identificado por um número único, com nome, cliente, CNPJ, contrato e local; pode aguardar revisão manual antes de ser liberado.
- **Recebimento da integração**: Solicitação autenticada que tenta criar um projeto ou confirmar idempotentemente um recebimento anterior.
- **Pendência de revisão**: Estado temporário associado ao projeto recebido automaticamente, visível aos gestores até confirmação ou exclusão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos envios válidos para números inéditos criam exatamente um projeto com os seis campos recebidos.
- **SC-002**: 100 repetições idênticas do mesmo envio mantêm apenas um projeto e retornam resultado idempotente.
- **SC-003**: 100% dos projetos criados pela integração aparecem ao gestor como pendentes em até 5 segundos após atualizar o painel.
- **SC-004**: Um gestor consegue localizar, abrir e confirmar um projeto recebido em menos de 2 minutos, sem consultar documentação externa.
- **SC-005**: Nenhum projeto pendente pode ser utilizado para criar relatório ou provisionar conta de cliente antes da confirmação manual.
- **SC-006**: 100% das solicitações sem credencial válida, com dados inválidos ou com número conflitante são rejeitadas sem criar ou alterar projeto.

## Assumptions

- A notificação solicitada é interna ao painel do gestor: contador na aba Projetos, bloco de pendências e destaque no cartão. Envio de e-mail, push ou integração com mensageria fica fora do escopo.
- A integração terá uma credencial de serviço própria, compartilhada por canal seguro entre os dois aplicativos e configurada separadamente por ambiente.
- O remetente usará nomes de campos estáveis definidos no contrato da integração; traduções automáticas de múltiplos formatos de payload ficam fora do escopo inicial.
- O número do projeto é a chave de idempotência e já é único no NewRDO.
- O cadastro recebido começa ativo, sem operador, usuários autorizados, segmento, e-mails de cliente ou sequências de relatório; esses dados permanecem para revisão/configuração posterior.
- A confirmação manual ocorre quando um gestor salva o cadastro pendente com todos os campos obrigatórios válidos; não é necessária uma segunda aprovação por outro usuário.
