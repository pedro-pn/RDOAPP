import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('manager report tabs opt into the DS shell and listing without changing the domain hooks', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');
  const reportTab = page.slice(
    page.indexOf('function renderReportTabContent'),
    page.indexOf('function renderProjectsTab')
  );

  assert.match(
    page,
    /const reportListingTab = tab === 'pendentes' \|\| tab === 'aprovados'/
  );
  assert.match(page, /<AppShell\b/);
  assert.match(page, /<PageHeader\b/);
  assert.match(page, /<ManagerReportListing\b/);
  assert.match(page, /appearance="design-system"/);
  assert.match(page, /<SearchInput\b/);
  assert.match(page, /<FilterBar\b/);
  assert.match(page, /<MetricCard\b/);
  assert.doesNotMatch(reportTab, /<Pagination\b/);

  for (const contract of [
    'useAccumulatedReportsPage',
    'usePersistentSearch',
    'useDebouncedValue',
    'useInfiniteScrollSentinel',
    'saveCurrentPageScroll',
    'rdoReportDetailPath'
  ]) {
    assert.match(page, new RegExp(`\\b${contract}\\b`));
  }
});

test('manager listing composes DataTable and MobileList explicitly while preserving DOM anchors', () => {
  const listing = source(
    'src/components/reports/manager/ManagerReportListing.tsx'
  );

  assert.match(listing, /<DataTable<ReportSummary>/);
  assert.match(listing, /mobile=\{\{/);
  assert.match(listing, /rdo-manager-listing__mobile-sort/);
  assert.match(listing, /showSelectAll: false/);
  assert.match(listing, /controlClassName: 'report-select-checkbox'/);
  assert.match(listing, /'rel-item rdo-manager-listing__row'/);
  assert.match(
    listing,
    /className="rel-name rdo-manager-listing__report-link"/
  );
  assert.match(listing, /onOpenReport/);
  assert.match(listing, /handleRowClick/);
  assert.match(listing, /data-row-navigation-ignore/);
  assert.match(listing, /onSortChange/);
  assert.doesNotMatch(listing, /from ['"]lucide-react['"]/);
});

test('manager row navigation preserves the non-clickable legacy side regions', () => {
  const legacyCard = source('src/components/reports/ReportSummaryCard.tsx');
  const listing = source(
    'src/components/reports/manager/ManagerReportListing.tsx'
  );

  assert.match(
    legacyCard,
    /className="report-card-select"[\s\S]*?event\.stopPropagation\(\)/
  );
  assert.match(
    legacyCard,
    /className="report-card-side"[\s\S]*?event\.stopPropagation\(\)/
  );
  assert.match(listing, /const tableCell = event\.target\.closest\('td, th'\)/);
  assert.match(listing, /tableCell\?\.matches\('\.fv-data-table__selection'\)/);
  assert.match(
    listing,
    /tableCell\?\.querySelector\('\[data-row-navigation-ignore\]'\)/
  );
  assert.match(listing, /\.fv-mobile-list__status, \.fv-mobile-list__actions/);
});

test('manager search only references the results region while that region exists', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');

  assert.match(
    page,
    /const reportResultsId =\s*projectsTab[\s\S]*?\? 'rdo-manager-project-results'[\s\S]*?archivedProjectsTab[\s\S]*?\? 'rdo-manager-archived-results'[\s\S]*?!reportListQuery\.isLoadingInitial &&[\s\S]*?pendingReports\.length[\s\S]*?approvedReports\.length[\s\S]*?\? 'rdo-manager-report-results'/
  );
  assert.match(page, /resultsId=\{reportResultsId\}/);
  assert.match(
    page,
    /className="rdo-manager-listing" id="rdo-manager-report-results"/
  );
  assert.equal(
    page.match(/id="rdo-manager-report-results"/g)?.length,
    1,
    'a região controlada deve existir uma única vez no estado populado'
  );
  assert.match(
    page,
    /id="rdo-manager-archived-results"[\s\S]*?aria-label="Lista de projetos arquivados"/
  );
  assert.match(
    page,
    /!reportListQuery\.isLoadingInitial && !archivedProjectsQuery\.isLoading/
  );
  assert.match(
    page,
    /!activeProjectsQuery\.isLoading && !activeProjectsQuery\.isError/
  );
  assert.match(page, /if \(reportListQuery\.isLoadingInitial\)/);
  assert.match(
    page,
    /if \(reportListQuery\.isError && !visibleReports\.length\)/
  );
  assert.match(page, /if \(!visibleReports\.length\)/);
});

test('manager pending and approved pages compose actions, search and real metrics in the DS hierarchy', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');

  assert.match(page, /search: debouncedGestorSearch \|\| undefined/);
  assert.match(page, /pendentes: 'Buscar em pendentes'/);
  assert.match(page, /className="rdo-manager-listing__page-header"/);
  assert.match(page, /Upload PDF antigo/);
  assert.match(page, /Criar Relatório/);
  assert.match(
    page,
    /label="Aguardando revisão"[\s\S]*?value=\{pendingCount\}/
  );
  assert.match(page, /label="Aprovados"[\s\S]*?value=\{approvedCount\}/);
  assert.match(page, /label="Assinados"[\s\S]*?value=\{signedCount\}/);
});

test('manager mobile composition keeps metrics in one row and removes redundant list detail', () => {
  const pageCss = source('src/pages/gestor/GestorPage.ds.css');
  const statsCss = source('src/components/stats/StatsDashboard.ds.css');
  const listing = source(
    'src/components/reports/manager/ManagerReportListing.tsx'
  );

  assert.match(
    pageCss,
    /@media \(max-width: 768px\)[\s\S]*?\.rdo-manager-metrics\s*\{[\s\S]*?display:\s*flex[\s\S]*?overflow-x:\s*auto/
  );
  assert.match(
    pageCss,
    /\.rdo-manager-metrics[\s\S]*?\.fv-metric-card__description\s*\{[\s\S]*?display:\s*none/
  );
  assert.match(
    pageCss,
    /\.fv-mobile-list__actions,\s*\.fv-mobile-list__details\)[\s\S]*?border-block-start:\s*0/
  );
  assert.match(
    pageCss,
    /\.rdo-manager-listing__batch-toolbar[\s\S]*?border-block:\s*0/
  );
  assert.match(
    statsCss,
    /@media \(max-width: 768px\)[\s\S]*?\.rdo-stats-overview__count-grid\s*\{[\s\S]*?display:\s*flex[\s\S]*?overflow-x:\s*auto/
  );
  assert.match(listing, /function mobileServicesLabel/);
  assert.match(listing, /\+\$\{remaining\} serviço/);
  assert.match(
    listing,
    /className="rdo-manager-listing__mobile-title"[\s\S]*?\{reportLabel\(report\)\}/
  );
});

test('grouped report list keeps legacy as the default and adds an accessible DS opt-in', () => {
  const grouped = source('src/components/reports/GroupedReportList.tsx');

  assert.match(grouped, /appearance = 'legacy'/);
  assert.match(grouped, /appearance === 'design-system'/);
  assert.match(grouped, /aria-expanded=\{!projectClosed\}/);
  assert.match(grouped, /aria-controls=\{projectPanelId\}/);
  assert.match(grouped, /aria-expanded=\{!typeClosed\}/);
  assert.match(grouped, /aria-controls=\{typePanelId\}/);
  assert.match(grouped, /renderReportCollection/);
});

test('RDO manager CSS is scoped, tokenized and uses only official breakpoints', () => {
  const css = `${source('src/pages/gestor/GestorPage.ds.css')}\n${source(
    'src/components/reports/manager/ManagerReportListing.css'
  )}`;

  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\brgba?\(/i);
  assert.doesNotMatch(css, /!important/);

  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media[^\{]+\{/g, '}')
    .matchAll(/(?:^|})\s*([^@{}][^{}]*)\{/g);
  for (const match of selectors) {
    assert.match(match[1], /:where\(\.fv-ds, \[data-fv-ds\]\)/);
  }

  const officialBreakpointEdges = new Set([
    '480',
    '768',
    '1024',
    '1280',
    '1536'
  ]);
  for (const match of css.matchAll(/@(media|container)\s*([^\{]+)/g)) {
    for (const value of match[2].matchAll(/(\d+(?:\.\d+)?)px\b/g)) {
      assert.ok(
        officialBreakpointEdges.has(value[1]),
        `Breakpoint não oficial no CSS RDO Gestor: ${value[0]}`
      );
    }
  }
});

test('other RDO profiles keep the legacy shell and do not consume the manager listing', () => {
  for (const path of [
    'src/pages/coordinator/CoordinatorPage.tsx',
    'src/pages/client/ClientPage.tsx',
    'src/pages/collaborator/MyReportsPage.tsx',
    'src/pages/collaborator/MyArchivedReportsPage.tsx'
  ]) {
    const page = source(path);
    assert.match(page, /from ['"]\.\.\/\.\.\/layout\/Shell['"]/);
    assert.doesNotMatch(page, /ManagerReportListing|<AppShell\b/);
  }
});
