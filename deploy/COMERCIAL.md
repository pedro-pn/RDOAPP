# Modulo Comercial — roteiro de implantacao

Roteiro para o **operador**. Nenhum comando aqui e executado por agente: eles sao
escritos para serem rodados por uma pessoa no servidor, conferindo o resultado de
cada um antes de seguir.

A ordem importa. Os passos 1 a 4 sao obrigatorios; os 5 a 8 sao as integracoes
externas, e **todas nascem desligadas** — o modulo funciona sem elas, so nao
manda nada para fora. O passo 9 e o que libera o acesso das pessoas.

---

## 1. Migrations

```bash
cd /caminho/do/app/backend
npm run prisma:deploy
```

O que as migrations do modulo criam:

- o schema `comercial`, separado do `public`;
- `CostEstimate`, `CostEstimateVersion`, `Proposal`, `ProposalDocument`,
  `ProposalAttachment`, `ProposalAuditLog`, `SalesAttribution`, `ScopeAsset`,
  `ScopePhotoAsset`, `ProposalNumberingState` e `ComercialSettings`;
- os valores `COMERCIAL`, `COMERCIAL_MANAGER`, `COMERCIAL_SELLER` e
  `COMERCIAL_VIEWER` nos enums de modulo e papel, no schema `public`.

Confira que nenhuma tabela da operacao foi tocada:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d filtrovali -c "\dt comercial.*"
```

## 2. Permissao no schema

O Prisma cria o schema, mas o papel da aplicacao precisa alcanca-lo. **Se o
backend conecta como superusuario (`postgres`), pule este passo** — ele ja
alcanca tudo.

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d filtrovali -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA comercial TO filtrovali_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA comercial TO filtrovali_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA comercial TO filtrovali_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA comercial
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO filtrovali_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA comercial
  GRANT USAGE, SELECT ON SEQUENCES TO filtrovali_app;
SQL
```

Troque `filtrovali_app` pelo papel real da `DATABASE_URL`. O
`ALTER DEFAULT PRIVILEGES` nao e detalhe: sem ele, a **proxima** migration cria
tabela que a aplicacao nao enxerga, e o sintoma aparece semanas depois.

## 3. Variaveis de ambiente

Em `backend/.env.production`. O arquivo tem segredo dentro:

```bash
chmod 600 backend/.env.production
```

```bash
# Raiz dos arquivos do modulo: documentos emitidos e fotos de escopo.
# VAZIO e o recomendado -- resolve para <REPORTS_DIR>/Comercial, que ja esta
# dentro do volume de relatorios e ja entra no backup. Ver o passo 10.
COMERCIAL_DIR=""
```

As integracoes tem bloco proprio, mais abaixo. **Todas comecam em `off`**, e o
modulo opera assim: os documentos sao gerados e ficam baixaveis pelo app; so o
envio para fora e que nao acontece.

## 4. Semeadura da numeracao

**Antes da primeira proposta.** Enquanto nao rodar, o modulo recusa numerar —
`GET /api/comercial/propostas/proximo-numero` responde `503`. E recusa
deliberada: emitir sem saber o maior numero ja usado produz codigo repetido no
documento que chega ao cliente.

Primeiro **relate**, sem gravar:

```bash
docker compose -f docker-compose.prod.yml exec -T backend \
  node scripts/semear-numeracao-comercial.mjs
```

O piso sai de `CommercialProposal.codProp`, a tabela importada do Access.
**Confira no Nectar antes de aplicar**: se o CRM ja emitiu numero maior que o da
importacao, informe-o a mao.

```bash
# usa o piso encontrado
docker compose -f docker-compose.prod.yml exec -T backend \
  node scripts/semear-numeracao-comercial.mjs --aplicar

# ou com o numero conferido no CRM
docker compose -f docker-compose.prod.yml exec -T backend \
  node scripts/semear-numeracao-comercial.mjs --aplicar --numero 4500
```

Roda **uma vez por ambiente**. Um numero consumido nao volta.

---

## 5. Nectar (CRM)

Nao existe sandbox: a API publica uma URL so, de producao. Por isso o padrao e
`off`, e por isso existe a lista de funis permitidos.

```bash
NECTAR_MODE="off"            # "real" so quando for para valer
NECTAR_API_TOKEN=""
NECTAR_PIPELINE_IDS=""       # lista de funis permitidos, separados por virgula
NECTAR_RESPONSAVEL_ID=""     # quem fica como autor dos cards
```

**Em staging, aponte `NECTAR_PIPELINE_IDS` para o funil de teste.** O funil real
so entra em producao. A lista e uma trava: um funil fora dela e recusado antes de
qualquer chamada.

## 6. SharePoint / OneDrive (Microsoft Graph)

Tambem sem ambiente de teste: o destino e a biblioteca real da empresa.

### 6.1 Registrar o aplicativo

**Entra ID** (`entra.microsoft.com`) → **Registros de aplicativo** → **Novo
registro**. Nome `Filtrovali — Comercial`, contas so deste diretorio, sem URI de
redirecionamento (nao ha login de usuario).

Da tela **Visao geral**, anote:

- **ID do aplicativo (cliente)** → `MICROSOFT_CLIENT_ID`
- **ID do diretorio (locatario)** → `MICROSOFT_TENANT_ID`

> Os dois sao GUID. Nao confunda com o **ID do objeto**, na linha seguinte, nem
> com a string longa em base64 que aparece nas permissoes do site — aquela e a
> identidade do app no SharePoint (`i:0i.t|ms.sp.ext|<guid>@<tenant>`) e nao
> autentica. Se um valor tem `~` no meio, e segredo, nao e id.

### 6.2 Criar o segredo

**Certificados e segredos** → **Novo segredo do cliente**, validade de 24 meses.

Copie a coluna **Valor** na hora — ela e mascarada depois de sair da tela, e o
que se copia entao nao serve. A coluna **ID do Segredo** e outra coisa e nao e
usada aqui.

**Anote a data de expiracao num lembrete.** Quando vencer, a finalizacao passa a
responder "nao foi possivel autenticar o servico no Microsoft 365", e sem o
lembrete ninguem liga uma coisa a outra.

Use um segredo **por ambiente**: se o de staging vazar, revoga-se um sem derrubar
o outro.

### 6.3 Permissao — menor privilegio

**Permissoes de API** → **Microsoft Graph** → **Permissoes de aplicativo** →
`Sites.Selected` → **Conceder consentimento do administrador**.

Confira que ficou **so** `Sites.Selected`. Permissoes sao somadas e a mais ampla
vence: um `Sites.Read.All` esquecido de um teste anula o ganho.

> `Sites.ReadWrite.All` tambem funciona, e e o que o modulo usava antes. Ela da
> ao app leitura e escrita em **todo site do SharePoint e todo OneDrive da
> empresa** — para um app que grava numa pasta, e desproporcional.

### 6.4 Liberar o site

`Sites.Selected` sozinha nao alcanca nada. Alguem com papel de administrador do
SharePoint precisa liberar site a site:

```powershell
Install-Module Microsoft.Graph -Scope CurrentUser   # so na primeira vez
Connect-MgGraph -Scopes "Sites.FullControl.All"

$site = Get-MgSite -SiteId "filtrovali.sharepoint.com:/sites/ArquivosFiltrovali"

New-MgSitePermission -SiteId $site.Id `
  -Roles @("write") `
  -GrantedToIdentities @(@{
      Application = @{ Id = "<MICROSOFT_CLIENT_ID>"; DisplayName = "Filtrovali - Comercial" }
  })
```

`write` basta: criar pasta e gravar arquivo cabem nele. `fullcontrol` daria ao
app o poder de mudar as proprias permissoes.

### 6.5 Pegar o ID da biblioteca

```powershell
Get-MgSiteDefaultDrive -SiteId $site.Id | Select-Object Id, Name, WebUrl
```

Confira o `WebUrl` antes de usar. O `Id` comeca com `b!`.

### 6.6 Configurar

```bash
SHAREPOINT_MODE="real"
MICROSOFT_TENANT_ID="<ID do diretorio>"
MICROSOFT_CLIENT_ID="<ID do aplicativo>"
MICROSOFT_CLIENT_SECRET="<o Valor do passo 6.2>"
SHAREPOINT_DRIVE_ID="<o Id do passo 6.5>"
SHAREPOINT_BASE_FOLDER="6 - DEPARTAMENTO COMERCIAL/<pasta das propostas>"
```

`SHAREPOINT_HOSTNAME` e `SHAREPOINT_SITE_PATH` ficam **vazios**. Com o
`DRIVE_ID`, o app vai direto a biblioteca e nao precisa descobrir nada — e e
justamente por nao descobrir que a `Sites.Selected` basta. Preenche-los faria o
app procurar o site, que e uma operacao de descoberta e pode voltar `403`.

**`SHAREPOINT_BASE_FOLDER` e a unica contencao que nao depende da Microsoft.**
Tudo e criado dentro dela, e **ela e criada se nao existir** — um caminho errado
nao da erro, cria uma pasta nova onde ninguem procura. Confira que o caminho
existe antes, com a barra e os espacos exatamente como aparecem no SharePoint.

Ela **nao tem valor padrao** (mudado em 14/08): com `SHAREPOINT_MODE=real` e a
variavel vazia, o envio **recusa** com o motivo, em vez de gravar na raiz da
biblioteca. Antes havia um padrao — `02 - Comercial/Projetos em cotacao` —, que
nao existe no tenant: esquecer a variavel criaria essa pasta na biblioteca do
cliente e gravaria as propostas la dentro, sem erro nenhum.

Na primeira vez, aponte para uma pasta de descarte (`teste`), emita uma proposta,
veja os arquivos chegarem, e so entao troque para a pasta real.

## 7. Google Maps

Duas APIs, e uma terceira se quiser as sugestoes de endereco. Todas no tier
Essentials, com 10.000 chamadas gratuitas por mes **por SKU**.

No console do Google, habilite:

| API | Para que |
|---|---|
| **Geocoding API** | endereco digitado → endereco oficial + `partial_match` |
| **Routes API** | distancia rodoviaria sede → obra |
| **Places API (New)** | sugestoes enquanto se digita (opcional) |

```bash
GOOGLE_MAPS_MODE="off"           # "real" para ligar
GOOGLE_MAPS_API_KEY=""
GOOGLE_MAPS_MAX_DIA="200"        # teto diario do calculo de distancia
GOOGLE_MAPS_MAX_DIA_SUGESTOES="300"  # teto diario das sugestoes
```

**Restrinja a chave no console**, por API e por IP do servidor. Chave sem
restricao que vaze e conta de outra pessoa gastando a franquia da empresa.

Os dois tetos existem porque a franquia e generosa e **invisivel**: um defeito em
laco passa das 10.000 sem ninguem notar, e so aparece na fatura. Sao contados a
parte um do outro porque um calculo de distancia e um clique, e uma sugestao e
uma tecla digitada.

## 8. Endereco da sede

**Nao e variavel de ambiente.** E a origem de toda distancia calculada, e um
gestor do modulo informa pela tela, em **Comercial → Configuracoes**.

Enquanto ninguem informar, o calculo de distancia responde que a sede nao foi
configurada e o campo continua digitado a mao — nada quebra.

Ao salvar, o endereco e localizado no Google e o identificador do lugar fica
gravado junto. Prefira **escolher da lista de sugestoes**: o texto passa a ser o
do proprio Google, e a origem para de depender de interpretacao.

---

## 9. Papeis das pessoas

Tres papeis, concedidos pela tela de contas do admin:

| Papel | Quem | Alcance |
|---|---|---|
| `comercial:manager` | **Aliander** e **Erike** | tudo: edita e finaliza qualquer registro, e e o unico que abre Configuracoes |
| `comercial:seller` | os vendedores | **apenas o que e dele** — levantamento e proposta de outro vendedor nao aparecem |
| `comercial:viewer` | quem so consulta | somente leitura, e **sem ver valor nenhum** (preco, custo, margem) |

A separacao entre vendedores e verificada no servidor, na listagem e no item.
Nao e a tela que esconde.

Conferencia depois de conceder: entre com um `comercial:seller` e abra a lista de
levantamentos. Deve aparecer **so o dele**.

## 10. Backup

Com `COMERCIAL_DIR` vazio (o recomendado), **nao ha nada a fazer**: os arquivos
ficam em `<REPORTS_DIR>/Comercial`, dentro do volume de relatorios, e ja entram no
`relatorios.tar.gz`. As fotos de escopo tambem — vivem sob a mesma raiz.

So se o `COMERCIAL_DIR` tiver sido apontado para **fora** do volume de relatorios:

```bash
# em deploy/backup-prod.sh e deploy/restore-prod.sh
COMERCIAL_VOLUME="filtrovali_comercial"
```

Sem isso os arquivos ficam fora do backup **em silencio**: o backup termina com
sucesso, e a falta so aparece no dia da restauracao.

Depois do primeiro backup, confirme:

```bash
tar -tzf /root/backups/filtrovali/latest/relatorios.tar.gz | grep -i '^./Comercial/' | head
```

## 11. nginx

**Nada a mudar no limite de corpo.** O `client_max_body_size` ja e `30M`, acima
do teto de requisicao do modulo (22 MB — 20 MB de anexos mais folga do
envelope).

O subdominio proprio e **opcional**, e segue o padrao do
`relatorios.filtrovali.com.br`: redireciona para dentro do app, nao serve
conteudo. Em `deploy/nginx/default.conf`:

```nginx
server {
  listen 80;
  server_name comercial.filtrovali.com.br;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location = / {
    return 301 https://app.filtrovali.com.br/comercial;
  }

  location / {
    return 301 https://app.filtrovali.com.br$request_uri;
  }
}

server {
  listen 443 ssl;
  server_name comercial.filtrovali.com.br;

  ssl_certificate     /etc/letsencrypt/live/comercial.filtrovali.com.br/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/comercial.filtrovali.com.br/privkey.pem;

  location = / {
    return 301 https://app.filtrovali.com.br/comercial;
  }

  location / {
    return 301 https://app.filtrovali.com.br$request_uri;
  }
}
```

O certificado precisa existir **antes** de o bloco `443` subir, senao o nginx nao
inicia e derruba os outros dominios junto:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot -d comercial.filtrovali.com.br

docker compose -f docker-compose.prod.yml exec nginx nginx -t
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

Lembre de incluir `https://comercial.filtrovali.com.br` em `ALLOWED_ORIGIN`.

---

## Conferencia final

```bash
# 1. o modulo responde
curl -s https://app.filtrovali.com.br/api/comercial/status

# 2. a numeracao foi semeada (nao pode dizer que falta semear)
curl -s -H "Authorization: Bearer <token>" \
  https://app.filtrovali.com.br/api/comercial/numeracao/status
```

Depois, pela tela, com uma proposta de descarte:

1. levantar um custo e conferir que o codigo e carimbado;
2. gerar a previa em PDF — prova que o LibreOffice e as fontes estao no container;
3. emitir os documentos e baixa-los;
4. finalizar, com as integracoes ligadas, e conferir o card no funil de **teste** e
   a pasta na pasta de **descarte** do SharePoint.

A finalizacao trata os dois destinos de forma independente: o card pode entrar e a
pasta falhar, e a resposta diz qual dos dois falhou. Os documentos ficam baixaveis
de qualquer jeito — falha de integracao nao perde trabalho.

## Se algo falhar

| Sintoma | Causa provavel |
|---|---|
| `503` ao pedir numero | passo 4 nao rodou |
| "nao foi possivel autenticar o servico no Microsoft 365" | segredo expirado, ou `CLIENT_ID` com a string base64 em vez do GUID |
| "a biblioteca de documentos nao foi localizada" | `SHAREPOINT_DRIVE_ID` errado, ou o site nao foi liberado no passo 6.4 |
| pasta criada em lugar estranho no SharePoint | `SHAREPOINT_BASE_FOLDER` aponta para caminho que nao existe — e foi criado |
| funil recusado ao finalizar | id fora de `NECTAR_PIPELINE_IDS` |
| distancia sempre em branco | sede nao configurada (passo 8), ou `GOOGLE_MAPS_MODE=off` |
| sugestao de endereco nao aparece | **Places API (New)** nao habilitada — e outra API |
| documento com fonte trocada | container sem as fontes Liberation/Carlito/Caladea |
