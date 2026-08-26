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

test('Arquivados faz opt-in explícito no DS sem alterar o default legacy compartilhado', () => {
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
  assert.match(archivedTab, /renderLoadMoreReports\('design-system'\)/);
  assert.match(archivedTab, /appearance: 'design-system'/);
  assert.match(
    archivedTab,
    /renderReportTypeSections\(projectReports, project\.id, 'design-system'\)/
  );
  assert.match(archivedTab, /<Button\b/);
  assert.doesNotMatch(archivedTab, /page-card|admin-stack|placeholder-copy/);
  assert.doesNotMatch(archivedTab, /mini-btn|primary-button|secondary-button/);
});

test('Arquivados preserva queries, busca, agrupamento, paginação e handlers de projeto', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');
  const archivedTab = sectionBetween(
    page,
    'function renderArchivedProjectsTab',
    'function renderEquipeTab'
  );
  const archivedTypeSections = sectionBetween(
    page,
    'function renderReportTypeSections',
    'function renderManualReportModal'
  );

  assert.match(
    page,
    /const archivedReportListQuery = useAccumulatedReportsPage\(\{[\s\S]*?statuses: \['APPROVED', 'SIGNED'\],[\s\S]*?projectActive: false,[\s\S]*?search: debouncedGestorSearch,[\s\S]*?projectSort: projectSortDir,[\s\S]*?pageSize: REPORT_PAGE_SIZE[\s\S]*?\}, tab === 'arquivados'\)/
  );
  assert.match(
    archivedTab,
    /\(archivedProjectsQuery\.data \|\| \[\]\)\.filter\(project => project\.isActive === false\)/
  );
  assert.match(archivedTab, /sortProjects\(archivedProjects, projectSortDir\)/);
  assert.match(
    archivedTab,
    /archivedReports\.filter\(report => report\.projectId === project\.id\)/
  );
  assert.match(
    archivedTab,
    /matchesSearch\(projectSearchParts\(project\), gestorSearch\)/
  );
  assert.match(
    archivedTab,
    /matchesSearch\(reportSearchParts\(report\), gestorSearch\)/
  );
  assert.match(
    archivedTab,
    /closedArchivedProjectIds\.includes\(project\.id\)/
  );
  assert.match(archivedTab, /onToggleArchive: handleProjectToggleArchive/);
  assert.match(archivedTab, /onRemove: handleProjectRemove/);
  assert.match(archivedTab, /onToggleDetails: toggleProjectDetails/);
  assert.match(
    archivedTab,
    /onToggleReports: item => toggleArchivedProject\(item\.id\)/
  );
  assert.match(archivedTab, /onSendSurvey: handleSendSurvey/);
  assert.match(archivedTab, /onResendSurvey: handleResendSurvey/);
  assert.match(archivedTab, /segments: projectSegmentsQuery\.data/);

  assert.match(
    archivedTypeSections,
    /reportListQuery\.projectTypeTotals\(projectId\)/
  );
  assert.match(archivedTypeSections, /reportListQuery\.groupLoadedCount\(/);
  assert.match(archivedTypeSections, /reportListQuery\.isGroupPageReady\(/);
  assert.match(archivedTypeSections, /reportListQuery\.isGroupError\(/);
  assert.match(archivedTypeSections, /reportListQuery\.isGroupLoading\(/);
  assert.match(archivedTypeSections, /revealMoreArchivedType\(/);
  assert.match(archivedTypeSections, /handleLoadMoreArchivedType\(/);
  assert.match(archivedTypeSections, /<InfiniteScrollSentinel/);
  assert.match(
    archivedTypeSections,
    /renderBatchReportActions\(visibleReports, designSystem\)/
  );
  assert.match(
    archivedTypeSections,
    /renderManagerReportActions\(report, true\)/
  );
});

test('Arquivados compõe primitives responsivos e mantém o opt-in restrito', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');
  const projectCard = sectionBetween(
    page,
    'function renderProjectCard',
    'export function GestorPage'
  );
  const archivedTypeSections = sectionBetween(
    page,
    'function renderReportTypeSections',
    'function renderManualReportModal'
  );
  const archivedTab = sectionBetween(
    page,
    'function renderArchivedProjectsTab',
    'function renderEquipeTab'
  );
  const search = sectionBetween(
    page,
    'function renderGestorSearch',
    'function renderEstatisticasTab'
  );
  const css = source('src/pages/gestor/GestorPage.ds.css');
  const cssStart = css.indexOf('Projetos arquivados');
  const cssEnd = css.indexOf('RDO B.11', cssStart);

  assert.match(projectCard, /appearance\?: 'legacy' \| 'design-system'/);
  assert.match(projectCard, /if \(options\.appearance === 'design-system'\)/);
  assert.match(projectCard, /<Card[\s\S]*?rdo-archived-project-card/);
  assert.match(projectCard, /<Badge\b/);
  assert.match(projectCard, /<StatusPill\b/);
  assert.match(projectCard, /<Alert\b/);
  assert.match(projectCard, /<Button\b/);
  assert.match(projectCard, /aria-expanded=\{options\.reportSectionExpanded\}/);
  assert.match(projectCard, /aria-expanded=\{options\.detailsExpanded\}/);
  assert.match(projectCard, /<dl>[\s\S]*?<dt>[\s\S]*?<dd>/);
  assert.match(projectCard, /className=\{`card admin-card project-admin-card/);

  assert.match(
    archivedTypeSections,
    /appearance: 'legacy' \| 'design-system' = 'legacy'/
  );
  assert.match(archivedTypeSections, /<ManagerReportListing/);
  assert.match(archivedTypeSections, /<Skeleton\b/);
  assert.match(archivedTypeSections, /<EmptyState\b/);
  assert.match(archivedTypeSections, /<IconButton\b/);
  assert.match(archivedTypeSections, /aria-controls=\{typeContentId\}/);
  assert.match(archivedTypeSections, /aria-expanded=\{!typeClosed\}/);

  assert.match(archivedTab, /<Skeleton\b/);
  assert.match(archivedTab, /<EmptyState\b/);
  assert.match(search, /tab === 'aprovados' \|\| tab === 'arquivados'/);
  assert.match(search, /<FilterBar[\s\S]*?<SearchInput/);
  assert.match(page, /const archivedProjectsTab = tab === 'arquivados'/);
  assert.match(page, /title="Projetos arquivados"/);

  assert.ok(cssStart >= 0, 'bloco CSS de Arquivados ausente');
  assert.ok(cssEnd > cssStart, 'limite do bloco CSS de Arquivados ausente');
  const archivedCss = css.slice(cssStart, cssEnd);
  assert.match(archivedCss, /:where\(\.fv-ds, \[data-fv-ds\]\)/);
  assert.match(archivedCss, /var\(--/);
  assert.match(archivedCss, /@media \(min-width: 768px\)/);
  assert.match(archivedCss, /@media \(max-width: 480px\)/);
  assert.doesNotMatch(archivedCss, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(archivedCss, /\brgba?\(/i);
  assert.doesNotMatch(archivedCss, /!important/);
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
