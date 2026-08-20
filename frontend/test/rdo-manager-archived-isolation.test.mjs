import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function sectionBetween(contents, start, end) {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end, startIndex);

  assert.notEqual(startIndex, -1, `Seção inicial ausente: ${start}`);
  assert.notEqual(endIndex, -1, `Seção final ausente: ${end}`);

  return contents.slice(startIndex, endIndex);
}

test('Arquivados mantém Carregar mais legacy e abas de relatórios usam Button DS por opt-in', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');
  const loadMoreRenderer = sectionBetween(
    page,
    'function renderLoadMoreReports',
    'function renderReportTabContent'
  );
  const reportTabs = sectionBetween(
    page,
    'function renderReportTabContent',
    'function renderProjectsTab'
  );
  const archivedTab = sectionBetween(
    page,
    'function renderArchivedProjectsTab',
    'function renderEquipeTab'
  );

  assert.match(
    loadMoreRenderer,
    /appearance:\s*'design-system' \| 'legacy' = 'legacy'/
  );
  assert.match(loadMoreRenderer, /appearance === 'design-system'/);
  assert.match(loadMoreRenderer, /<Button\b/);
  assert.match(loadMoreRenderer, /className="mini-btn"/);
  assert.match(
    loadMoreRenderer,
    /reportListQuery\.isLoadingMore\s*\? 'Carregando\.\.\.'\s*: 'Carregar mais'/
  );

  assert.match(reportTabs, /renderLoadMoreReports\('design-system'\)/);
  assert.match(archivedTab, /renderLoadMoreReports\(\)/);
  assert.doesNotMatch(archivedTab, /renderLoadMoreReports\('design-system'\)/);
  assert.doesNotMatch(archivedTab, /<Button\b|fv-button/);
});

test('consumidores legacy de GroupedReportList não fazem opt-in no Design System', () => {
  for (const path of [
    'src/pages/coordinator/CoordinatorPage.tsx',
    'src/pages/collaborator/MyReportsPage.tsx',
    'src/pages/collaborator/MyArchivedReportsPage.tsx'
  ]) {
    const page = source(path);

    assert.match(page, /<GroupedReportList\b/, path);
    assert.doesNotMatch(page, /appearance="design-system"/, path);
  }
});
