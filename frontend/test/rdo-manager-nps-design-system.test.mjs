import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(join(frontendRoot, path), 'utf8');

const expectedAppearance = (() => {
  const value = process.env.RDO_B9_EXPECT_APPEARANCE ?? 'design-system';
  if (value === 'legacy' || value === 'design-system') return value;
  throw new Error(`RDO_B9_EXPECT_APPEARANCE inválido: ${value}`);
})();

function npsTabSource() {
  const gestor = source('src/pages/gestor/GestorPage.tsx');
  const start = gestor.indexOf('function renderNpsTab()');
  assert.ok(start > 0, 'renderNpsTab não encontrado');
  const end = gestor.indexOf('function renderGestorSearch()', start);
  assert.ok(end > start, 'fim de renderNpsTab não encontrado');
  return gestor.slice(start, end);
}

test('B.9 preserva a derivação de dados da aba NPS', () => {
  const tab = npsTabSource();

  // Origem dos dados: bootstrap do Gestor, sem GET dedicado.
  const gestor = source('src/pages/gestor/GestorPage.tsx');
  assert.match(
    gestor,
    /const surveysQuery = \{ data: gestorBootstrapQuery\.data\?\.surveys, isLoading: gestorBootstrapQuery\.isLoading \};/
  );
  assert.doesNotMatch(tab, /useQuery|queryKey|useSurveys\(/);

  // Filtro pela busca do Gestor, com os mesmos campos.
  assert.match(tab, /matchesSearch\(parts, gestorSearch\)/);
  for (const field of [
    'survey\\.project\\?\\.code',
    'survey\\.project\\?\\.name',
    'survey\\.project\\?\\.clientName',
    'survey\\.emailTo'
  ]) {
    assert.match(tab, new RegExp(field));
  }
  assert.match(tab, /surveyStatusLabel\(survey\)\.label\.toLowerCase\(\)/);

  // Agrupamento e título.
  assert.match(tab, /npsProjectKey\(survey\)/);
  assert.match(tab, /npsProjectTitle\(survey\)/);

  // Ordenação dos grupos e das pesquisas.
  assert.match(tab, /npsSortDir === 'asc'/);
  assert.match(
    tab,
    /localeCompare\(titleB, 'pt-BR', \{ numeric: true, sensitivity: 'base' \}\)/
  );
  assert.match(
    tab,
    /new Date\(b\.sentAt\)\.getTime\(\) - new Date\(a\.sentAt\)\.getTime\(\)/
  );

  // Numeração decrescente e acordeão de um único item.
  assert.match(tab, /Pesquisa #\$\{group\.surveys\.length - index\}/);
  assert.match(
    tab,
    /setOpenSurveyId\(current => current === survey\.id \? null : survey\.id\)/
  );
  assert.match(tab, /const open = openSurveyId === survey\.id/);

  // Condição de reenvio e handler/pending preservados.
  assert.match(
    tab,
    /const canResendSurvey = !survey\.respondedAt && survey\.project\?\.isActive === false/
  );
  assert.match(tab, /handleResendSurvey\(survey\)/);
  assert.match(tab, /surveyMutations\.resendSurvey\.isPending/);

  // Condição de loading inalterada.
  assert.match(tab, /surveysQuery\.isLoading/);

  // Textos preservados literalmente.
  assert.match(tab, /Pesquisas pendentes, respondidas e expiradas\./);
  assert.match(tab, /Pesquisa expirada sem resposta do cliente\./);
  assert.match(tab, /Pesquisa enviada, aguardando resposta do cliente\./);
  assert.match(tab, /Nenhuma pesquisa encontrada\./);
  assert.match(tab, /Nenhuma pesquisa NPS disponível\./);
  assert.match(tab, /Carregando pesquisas\.\.\./);
  assert.match(tab, /Reenviar pesquisa/);
  assert.match(tab, /Editar pesquisa/);
  assert.match(tab, /Dashboard NPS/);
});

test('B.9 não introduz persistência, URL, paginação nem confirmação', () => {
  const tab = npsTabSource();

  assert.doesNotMatch(tab, /localStorage|sessionStorage/);
  assert.doesNotMatch(tab, /useSearchParams|setSearchParams|navigate\(/);
  assert.doesNotMatch(tab, /window\.confirm|ConfirmDialog/);
  assert.doesNotMatch(tab, /refetchInterval|setInterval/);
  assert.doesNotMatch(tab, /Pagination|pageSize|onSelectionChange/);

  // O handler de reenvio continua sendo o único ponto de mutation da aba.
  const mutations = tab.match(/\.mutate\(|mutateAsync\(/g) ?? [];
  assert.deepEqual(mutations, []);
});

test('B.9 usa os primitives DS existentes na aba do Gestor', () => {
  const tab = npsTabSource();

  if (expectedAppearance === 'legacy') {
    assert.match(tab, /className="nps-tab-content"/);
    assert.doesNotMatch(tab, /rdo-nps/);
    return;
  }

  assert.match(tab, /className="fv-ds rdo-nps rdo-ds-actions"/);
  assert.match(tab, /aria-labelledby="rdo-nps-title"/);
  // A área de toque das ações compactas vem da escala compartilhada já
  // existente (a9b49969), não de uma nova regra local.
  assert.match(
    source('src/pages/gestor/GestorPage.tsx'),
    /styles\/rdo-ds-actions\.css/
  );
  assert.match(tab, /<h2 id="rdo-nps-title">NPS<\/h2>/);
  assert.match(tab, /<h3 className="rdo-nps__group-title">/);

  for (const component of [
    'Card',
    'Button',
    'StatusPill',
    'Skeleton',
    'EmptyState'
  ]) {
    assert.match(tab, new RegExp(`<${component}\\b`));
  }

  // As classes legadas da aba deixaram de ser usadas aqui.
  for (const legacy of [
    'nps-tab-content',
    'nps-tab-toolbar',
    'admin-card',
    'admin-stack',
    'mini-btn',
    'section-title',
    'client-account-group-toggle',
    'status-pill'
  ]) {
    assert.doesNotMatch(tab, new RegExp(`"[^"]*\\b${legacy}\\b`));
  }
});

test('B.9 corrige a acessibilidade do acordeão de pesquisas', () => {
  if (expectedAppearance === 'legacy') return;
  const tab = npsTabSource();

  // aria-expanded reflete o estado real de openSurveyId.
  assert.match(tab, /aria-expanded=\{open\}/);
  // aria-controls aponta para um id único e estável por pesquisa.
  assert.match(tab, /const panelId = `rdo-nps-panel-\$\{survey\.id\}`/);
  assert.match(tab, /aria-controls=\{panelId\}/);
  assert.match(tab, /id=\{panelId\}/);
  assert.match(tab, /hidden=\{!open\}/);
  // Nome acessível distinguível por pesquisa.
  assert.match(tab, /aria-label=\{`\$\{surveyLabel\} — \$\{group\.title\}`\}/);
});

test('B.9 mantém as ações secundárias compactas', () => {
  if (expectedAppearance === 'legacy') return;
  const tab = npsTabSource();

  // Nenhuma ação da aba escapa da escala compacta estabelecida em a9b49969.
  const sizes = tab.match(/<Button[\s\S]{0,160}?size="(\w+)"/g) ?? [];
  assert.ok(sizes.length >= 3, 'esperados ao menos três Button na aba');
  assert.doesNotMatch(tab, /<Button[\s\S]{0,160}?size="(?:md|lg)"/);
  for (const action of [
    'Editar pesquisa',
    'Dashboard NPS',
    'Reenviar pesquisa'
  ]) {
    assert.match(
      tab,
      new RegExp(`size="sm"[\\s\\S]{0,420}?>\\s*${action}`),
      `${action} deve usar size="sm"`
    );
  }
});

test('B.9 mantém o CSS escopado e tokenizado', () => {
  if (expectedAppearance === 'legacy') return;
  const css = source('src/pages/gestor/GestorPage.ds.css');
  const start = css.indexOf('RDO B.9');
  assert.ok(start > 0, 'bloco da B.9 não encontrado no CSS');
  const block = css.slice(start);

  assert.match(block, /:where\(\.fv-ds, \[data-fv-ds\]\)\.rdo-nps/);
  assert.match(block, /var\(--/);
  assert.doesNotMatch(block, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(block, /\brgba?\(/i);
  assert.doesNotMatch(block, /!important/);

  // A área de toque do toggle é preservada mesmo com caixa compacta.
  assert.match(
    block,
    /min-height: calc\(var\(--space-10\) \+ var\(--space-1\)\)/
  );

  // Nenhum seletor escapa de `.rdo-nps` (divisão ciente de parênteses).
  const splitSelectorList = (text) => {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const character of text) {
      if (character === '(') depth += 1;
      else if (character === ')') depth -= 1;
      if (character === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += character;
    }
    parts.push(current);
    return parts;
  };

  const selectors = block
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((chunk) => chunk.slice(0, chunk.indexOf('{')))
    .flatMap(splitSelectorList)
    .filter((text) => !text.trim().startsWith('@'))
    .map((selector) => selector.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  assert.ok(selectors.length > 0);
  for (const selector of selectors) {
    assert.match(
      selector,
      /\.rdo-nps\b/,
      `seletor fora do escopo .rdo-nps: ${selector}`
    );
  }
});

test('B.9 não altera o Coordenador nem os componentes compartilhados', () => {
  const coordinator = source('src/pages/coordinator/CoordinatorPage.tsx');

  // O Coordenador tem implementação própria de NPS e segue integralmente legacy.
  assert.match(coordinator, /function renderNpsTab\(\)/);
  assert.match(coordinator, /className="nps-tab-content"/);
  assert.doesNotMatch(coordinator, /rdo-nps/);
  assert.doesNotMatch(coordinator, /appearance="design-system"/);
  assert.doesNotMatch(coordinator, /gestorSurveyHelpers/);

  // A superfície DS da B.9 existe somente no Gestor.
  const files = [];
  (function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (/\.tsx?$/.test(entry.name)) files.push(absolutePath);
    }
  })(join(frontendRoot, 'src'));

  const owners = files
    .filter((path) => /rdo-nps/.test(readFileSync(path, 'utf8')))
    .sort();
  assert.deepEqual(owners, [
    join(frontendRoot, 'src/pages/gestor/GestorPage.tsx')
  ]);

  // O overlay e os helpers continuam legacy e intocados pela B.9.
  const helpers = source('src/pages/gestor/gestorSurveyHelpers.ts');
  assert.match(helpers, /className: 'status-approved'/);
  assert.match(helpers, /className: 'status-returned'/);
  assert.match(helpers, /className: 'status-pending'/);

  const surveyDashboard = source('src/components/surveys/SurveyDashboard.tsx');
  assert.doesNotMatch(surveyDashboard, /rdo-nps|appearance/);

  const sortButton = source('src/utils/ProjectSortButton.tsx');
  assert.doesNotMatch(sortButton, /fv-button|rdo-nps/);
});
