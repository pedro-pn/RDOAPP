import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(join(frontendRoot, path), 'utf8');

const expectedAppearance = (() => {
  const value = process.env.RDO_B8_EXPECT_APPEARANCE ?? 'design-system';
  if (value === 'legacy' || value === 'design-system') return value;
  throw new Error(`RDO_B8_EXPECT_APPEARANCE inválido: ${value}`);
})();

function sourceFilesUnder(path) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(absolutePath);
    }
  }
  visit(join(frontendRoot, path));
  return files;
}

test('B.8 preserves the dds-theme query, original order and mutation contracts', () => {
  const manager = source('src/components/reports/DdsThemeManager.tsx');
  const api = source('src/api/ddsThemes.ts');

  assert.match(
    manager,
    /queryKey: \['dds-themes', 'all'\], queryFn: \(\) => listDdsThemes\(true\)/
  );
  assert.match(manager, /const themes = data \?\? \[\]/);
  assert.doesNotMatch(manager, /themes\.(?:sort|toSorted|filter)\(/);
  assert.match(
    manager,
    /invalidateQueries\(\{ queryKey: \['dds-themes'\] \}\)/
  );

  assert.match(
    manager,
    /mutationFn: \(name: string\) => createDdsTheme\(name\)/
  );
  assert.match(manager, /const name = newName\.trim\(\)/);
  assert.match(manager, /if \(!name \|\| createMutation\.isPending\) return/);
  assert.match(manager, /createMutation\.mutate\(name\)/);
  assert.match(manager, /Tema adicionado\./);
  assert.match(manager, /Não foi possível adicionar \(nome já existe\?\)\./);

  assert.match(manager, /updateDdsTheme\(payload\.id, payload\.data\)/);
  assert.match(
    manager,
    /\{ id: theme\.id, data: \{ name: editing\.name\.trim\(\) \} \}/
  );
  assert.match(manager, /\{ id: theme\.id, data: \{ isActive: true \} \}/);
  assert.match(manager, /Tema atualizado\./);
  assert.match(manager, /Não foi possível atualizar o tema\./);

  assert.match(
    manager,
    /mutationFn: \(id: string\) => deactivateDdsTheme\(id\)/
  );
  assert.match(manager, /deactivateMutation\.mutate\(theme\.id\)/);
  assert.match(manager, /Tema desativado\./);
  assert.match(manager, /Não foi possível desativar o tema\./);

  // A API do RDO permanece intocada pela B.8.
  assert.match(
    api,
    /rdoApiPath\(`\/dds-themes\$\{all \? '\?all=true' : ''\}`\)/
  );
  assert.match(
    api,
    /apiClient\.post<DdsTheme>\(rdoApiPath\('\/dds-themes'\), \{ name \}\)/
  );
  assert.match(
    api,
    /apiClient\.patch<DdsTheme>\(rdoApiPath\(`\/dds-themes\/\$\{id\}`\), payload\)/
  );
  assert.match(
    api,
    /apiClient\.delete\(rdoApiPath\(`\/dds-themes\/\$\{id\}`\)\)/
  );
});

test('B.8 preserves pending, disabled, reset and legacy rendering contracts', () => {
  const manager = source('src/components/reports/DdsThemeManager.tsx');

  assert.match(
    manager,
    /disabled=\{createMutation\.isPending \|\| !newName\.trim\(\)\}/
  );
  assert.match(
    manager,
    /disabled=\{updateMutation\.isPending \|\| !editing\.name\.trim\(\)\}/
  );
  assert.match(manager, /disabled=\{deactivateMutation\.isPending\}/);
  assert.match(manager, /setShowCreateForm\(false\); setNewName\(''\)/);
  assert.match(manager, /setEditing\(null\)/);

  // O caminho legacy continua existindo byte a byte para o Coordenador.
  assert.match(manager, /className="page-card"/);
  assert.match(manager, /className="admin-stack"/);
  assert.match(manager, /className="mini-btn"/);
  assert.match(manager, /id="dds-theme-name"/);
  assert.match(manager, /Carregando temas…/);

  // A B.8 não introduz confirmação, filtro, paginação, autosave ou polling.
  assert.doesNotMatch(manager, /window\.confirm|ConfirmDialog|refetchInterval/);
  assert.doesNotMatch(manager, /useSearchParams|localStorage|sessionStorage/);
});

test('B.8 keeps legacy as default and opts in only the Gestor dds-theme surface', () => {
  const manager = source('src/components/reports/DdsThemeManager.tsx');
  const gestor = source('src/pages/gestor/GestorPage.tsx');
  const coordinator = source('src/pages/coordinator/CoordinatorPage.tsx');

  // O Coordenador permanece integralmente legacy.
  assert.match(coordinator, /<DdsThemeManager\s*\/>/);
  assert.doesNotMatch(coordinator, /<DdsThemeManager\b[^>]*appearance=/s);

  if (expectedAppearance === 'legacy') {
    assert.match(manager, /export function DdsThemeManager\(\)/);
    assert.doesNotMatch(manager, /appearance\s*[?:=]/);
    assert.match(gestor, /<DdsThemeManager\s*\/>/);
    return;
  }

  assert.match(manager, /appearance\?: DdsThemeManagerAppearance/);
  assert.match(manager, /appearance = 'legacy'/);
  assert.match(manager, /appearance === 'design-system'/);
  assert.match(gestor, /<DdsThemeManager appearance="design-system"\s*\/>/);

  // Existe exatamente um opt-in em todo o `src`, e ele pertence ao Gestor.
  const optIns = sourceFilesUnder('src').filter((path) =>
    /<DdsThemeManager\b[^>]*appearance=["'{]/s.test(readFileSync(path, 'utf8'))
  );
  assert.deepEqual(optIns, [
    join(frontendRoot, 'src/pages/gestor/GestorPage.tsx')
  ]);

  // Nenhum outro consumidor de DdsThemeManager existe além de Gestor e
  // Coordenador.
  const consumers = sourceFilesUnder('src')
    .filter((path) => /<DdsThemeManager\b/s.test(readFileSync(path, 'utf8')))
    .sort();
  assert.deepEqual(consumers, [
    join(frontendRoot, 'src/pages/coordinator/CoordinatorPage.tsx'),
    join(frontendRoot, 'src/pages/gestor/GestorPage.tsx')
  ]);
});

test('B.8 keeps the shared dds-themes cache consumers untouched', () => {
  const reportDetail = source('src/pages/ReportDetailPage.tsx');
  const newReport = source('src/pages/collaborator/NewReportPage.tsx');
  const reviewAlert = source(
    'src/components/reports/DdsCustomThemeReviewAlert.tsx'
  );

  assert.match(
    reportDetail,
    /queryKey: \['dds-themes'\], queryFn: \(\) => listDdsThemes\(\)/
  );
  assert.match(
    newReport,
    /queryKey: \['dds-themes'\], queryFn: \(\) => listDdsThemes\(\)/
  );
  assert.match(
    reviewAlert,
    /invalidateQueries\(\{ queryKey: \['dds-themes'\] \}\)/
  );
});

test('B.8 DS branch uses existing responsive primitives and scoped tokens', () => {
  if (expectedAppearance === 'legacy') return;

  const manager = source('src/components/reports/DdsThemeManager.tsx');
  const css = source('src/components/reports/DdsThemeManager.ds.css');

  for (const component of [
    'Button',
    'Card',
    'DataTable',
    'EmptyState',
    'Field',
    'Input',
    'Skeleton',
    'StatusPill'
  ]) {
    assert.match(manager, new RegExp(`<${component}\\b`));
  }
  assert.match(manager, /mobile=\{\{/);
  assert.match(manager, /renderItem:/);
  assert.match(manager, /createInputRef\.current\?\.focus\(\)/);
  assert.match(manager, /editingInputRef\.current\?\.focus\(\)/);
  assert.match(manager, /data-dds-theme-create/);
  assert.match(manager, /data-dds-theme-rename=\{theme\.id\}/);
  assert.match(manager, /Novo nome para \$\{theme\.name\}/);
  assert.match(manager, /event\.key !== 'Escape'/);
  assert.match(manager, /<h2 id="rdo-dds-themes-title">Temas de DDS<\/h2>/);

  // O anel de foco pertence ao control shell; o outline do input é neutralizado
  // apenas dentro desta superfície (nunca em foundation.css).
  assert.match(
    css,
    /\.fv-ds\.rdo-dds-themes \.fv-input:focus-visible \{\s*outline: 0;/
  );

  // Todo o CSS da migração é escopado e tokenizado.
  assert.match(css, /\.rdo-dds-themes/);
  assert.match(css, /var\(--/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\brgba?\(/i);
  assert.doesNotMatch(css, /!important/);
  // Cada seletor declarado no arquivo precisa estar sob .rdo-dds-themes, para
  // que a migração não vaze para nenhuma outra superfície.
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((block) => block.slice(0, block.indexOf('{')))
    .flatMap((text) => text.split(','))
    .filter((text) => !text.trim().startsWith('@'))
    .map((selector) => selector.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  assert.ok(selectors.length > 0);
  for (const selector of selectors) {
    assert.match(
      selector,
      /\.rdo-dds-themes\b/,
      `seletor fora do escopo .rdo-dds-themes: ${selector}`
    );
  }
});
