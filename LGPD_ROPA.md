# Registro de Atividades de Tratamento (ROPA) — NewRDO

**Versão:** ropa_v1
**Data:** 2026-05-22
**Controlador:** Filtrovali Serviços de Filtragem de Óleos Industriais e Limpeza de Tubulações Ltda.
**Canal de privacidade:** privacidade@filtrovali.com.br

Este documento resume as principais operações de tratamento de dados pessoais do NewRDO para revisão operacional e jurídica periódica.

| Operação | Categorias de titulares | Dados tratados | Finalidade | Base legal | Retenção | Sistemas/operadores | Medidas de segurança |
|---|---|---|---|---|---|---|---|
| Contas e autenticação | Usuários internos, clientes e assinantes secundários | Nome, usuário, e-mail, perfil, CNPJ vinculado, sessões e logs de acesso | Autenticar usuários e controlar permissões | Execução de contrato; legítimo interesse em segurança | Enquanto houver vínculo; sessões e tokens expiram automaticamente | NewRDO, banco de dados, provedor de hospedagem | Senhas com hash, sessões por token, controle de perfil e módulos |
| RDO e relatórios de serviço | Colaboradores, gestores, coordenadores, representantes de clientes | Dados de projeto, relatório, equipe, serviços, anexos, comentários, aprovações e reprovações | Gerar, revisar, aprovar e armazenar relatórios de serviço | Execução de contrato; exercício regular de direitos | Relatórios e evidências mantidos pelo prazo jurídico aplicável | NewRDO, armazenamento de arquivos, banco de dados | Controle de acesso por perfil/projeto, auditoria, validação de permissões |
| Assinatura eletrônica de RDO | Signatários externos e clientes autenticados | Nome declarado, e-mail, imagem da assinatura, IP, User-Agent, data/hora, hash/documento | Comprovar assinatura e integridade do documento | Execução de contrato; exercício regular de direitos | Evidências de RDO por 5 anos ou prazo jurídico aplicável | NewRDO, armazenamento de PDF/evidências | Aviso de privacidade, hash documental, código de validação, trilha de auditoria |
| EPI | Colaboradores, técnicos/gestores, signatários | Dados de colaborador, equipamentos entregues, assinatura, IP, User-Agent, PDF assinado | Registrar entrega de EPI e cumprir obrigações trabalhistas | Cumprimento de obrigação legal; execução de contrato de trabalho | Até 20 anos quando aplicável | NewRDO, armazenamento de PDF/evidências | Controle de acesso, auditoria, assinatura e retenção de evidências |
| Pesquisa de satisfação | Representantes de clientes | E-mail, projeto, respostas, comentários, IP, User-Agent, datas de envio/resposta | Avaliar qualidade e melhoria do serviço | Legítimo interesse | Respostas por 2 anos; IP/User-Agent anonimizados após 1 ano da resposta | NewRDO, e-mail transacional | Link individual, opt-out de lembretes, aviso de privacidade |
| Romaneio | Usuários internos, motoristas e destinatários de notificação | Dados de romaneio, motorista, placa, itens, destinatários de e-mail | Operar logística, documentação e envio de romaneios | Execução de contrato; legítimo interesse operacional | Conforme necessidade contratual e fiscal/operacional | NewRDO, e-mail transacional, armazenamento de documentos | Controle de acesso por módulo, geração documental, logs operacionais |
| Propostas comerciais | Contatos de clientes (pessoas de contato nas empresas), vendedores e gestores internos | Nome do contato, e-mail, cargo/departamento, empresa e CNPJ, endereço do local da obra, vendedor responsável, anexos enviados pelo vendedor, histórico de revisões e trilha de auditoria | Elaborar, emitir e acompanhar propostas técnicas e comerciais | Procedimentos preliminares relacionados a contrato, a pedido do titular (Art. 7º, V); legítimo interesse na relação comercial entre empresas | **Indefinida** (FR-042): a proposta é registro comercial e não é apagada; o módulo arquiva, não exclui. Anexos e documentos emitidos seguem a proposta | NewRDO; **Nectar CRM** (operador — recebe o card da oportunidade com nome e e-mail do contato); **Microsoft 365 / SharePoint** (operador — recebe os documentos emitidos); **Google Maps** (recebe o endereço da obra para cálculo de distância, sem dado de pessoa) | Acesso por papel, com o vendedor alcançando **apenas os próprios registros**; supressão de valores para o papel de consulta feita na serialização, não na tela; trilha de auditoria por proposta; integrações desligadas por padrão e limitadas a destino configurado |
| Auditoria e segurança | Todos os usuários e titulares envolvidos em ações auditáveis | Usuário, ação, data/hora, IP, User-Agent, identificadores técnicos | Segurança, rastreabilidade, prevenção a fraudes e defesa de direitos | Legítimo interesse; exercício regular de direitos | IP/User-Agent de logs operacionais anonimizados após 2 anos | NewRDO, banco de dados | Logs de auditoria, minimização no job de retenção |
| Direitos do titular | Titulares que acionam o canal LGPD | Nome, e-mail, identificador, tipo de solicitação, detalhes, protocolo, IP/User-Agent | Receber, registrar e responder solicitações do Art. 18 da LGPD | Cumprimento de obrigação legal/regulatória | Pelo período necessário para comprovação de atendimento | NewRDO, canal de privacidade | Protocolo único, status, controle de escopo e análise manual |

## Revisão

- Periodicidade recomendada: trimestral ou semestral.
- Responsável: canal de privacidade da Filtrovali ou encarregado definido internamente.
- A revisão deve verificar novos módulos, novos operadores, alterações de retenção e mudanças em bases legais.

## Notas por operação

### Propostas comerciais (módulo Comercial)

- **A retenção indefinida é deliberada** e vem do FR-042: a proposta é registro
  comercial da negociação. O módulo **arquiva e não exclui** — não existe rota de
  exclusão. Um pedido de eliminação sob o Art. 18, VI encontra esse limite e deve ser
  tratado pelo canal de privacidade, que avalia caso a caso o que pode ser
  anonimizado sem descaracterizar o registro.
- **Três operadores recebem dados**, e é o que mais pesa nesta linha:
  - **Nectar CRM** — o card da oportunidade leva nome e e-mail do contato do cliente;
  - **Microsoft 365 / SharePoint** — recebe os documentos emitidos, que contêm os
    dados do contato e do local da obra;
  - **Google Maps** — recebe o endereço da obra para calcular distância. É endereço de
    instalação industrial, não de pessoa.
  As três integrações **nascem desligadas** e só enviam ao destino configurado. Uma
  instalação sem elas não transfere nada para fora.
- **Transferência internacional**: Nectar (Brasil), Microsoft e Google operam fora do
  país. A avaliação de adequação cabe ao canal de privacidade antes do go-live com as
  integrações ligadas.
