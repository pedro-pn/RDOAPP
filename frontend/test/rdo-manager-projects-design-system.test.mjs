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

test('Projetos migra a superfície principal com opt-in explícito no DS', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');
  const projectsTab = sectionBetween(
    page,
    'function renderProjectsTab',
    'function renderArchivedProjectsTab'
  );
  const search = sectionBetween(
    page,
    'function renderGestorSearch',
    'function renderEstatisticasTab'
  );

  assert.match(page, /const projectsTab = tab === 'projetos'/);
  assert.match(page, /'rdo-manager-projects-page'/);
  assert.match(
    page,
    /title="Projetos"[\s\S]*?description="Gerencie os projetos ativos, acompanhe cadastros pendentes e revise suas informações\."/
  );
  assert.match(page, />\s*Novo projeto\s*<\/Button>/);

  assert.match(projectsTab, /id="rdo-manager-project-results"/);
  assert.match(projectsTab, /className="rdo-manager-projects rdo-ds-actions"/);
  assert.match(projectsTab, /aria-label="Lista de projetos ativos"/);
  assert.match(projectsTab, /appearance: 'design-system'/);
  assert.match(projectsTab, /<Badge\b/);
  assert.match(projectsTab, /<Button\b/);
  assert.match(projectsTab, /<Card\b/);
  assert.match(projectsTab, /<Skeleton\b/);
  assert.match(projectsTab, /<EmptyState\b/);
  assert.doesNotMatch(
    projectsTab,
    /<section className="page-card project-admin-panel"/
  );

  assert.match(
    search,
    /tab === 'aprovados' \|\| tab === 'projetos' \|\| tab === 'arquivados'/
  );
  assert.match(search, /'rdo-manager-project-results'/);
  assert.match(search, /'Busca dos projetos ativos'/);
  assert.match(search, /<FilterBar[\s\S]*?<SearchInput/);
});

test('Projetos preserva bootstrap, busca, ordenação e contratos CRUD', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');
  const projectsTab = sectionBetween(
    page,
    'function renderProjectsTab',
    'function renderArchivedProjectsTab'
  );
  const submit = sectionBetween(
    page,
    'async function handleProjectSubmit',
    'async function handleSegmentSubmit'
  );
  const archive = sectionBetween(
    page,
    'async function applyProjectArchiveChange',
    'async function handleSendSurvey'
  );
  const remove = sectionBetween(
    page,
    'async function handleProjectRemove',
    'async function handleCollaboratorSubmit'
  );

  assert.match(page, /data: gestorBootstrapQuery\.data\?\.activeProjects/);
  assert.match(
    projectsTab,
    /partitionProjectsByRegistration\(allActiveProjects\)/
  );
  assert.match(
    projectsTab,
    /matchesSearch\(projectSearchParts\(project\), gestorSearch\)/
  );
  assert.match(
    projectsTab,
    /sortProjects\(pendingRegistrationProjects, projectSortDir\)/
  );
  assert.match(projectsTab, /sortProjects\(activeProjects, projectSortDir\)/);
  assert.match(projectsTab, /onToggleArchive: handleProjectToggleArchive/);
  assert.match(projectsTab, /onRemove: handleProjectRemove/);
  assert.match(projectsTab, /onToggleDetails: toggleProjectDetails/);
  assert.match(projectsTab, /segments: projectSegmentsQuery\.data/);

  assert.match(submit, /event\.preventDefault\(\)/);
  assert.match(submit, /projectMutations\.updateProject\.mutateAsync/);
  assert.match(
    submit,
    /projectMutations\.createProject\.mutateAsync\(payload\)/
  );
  assert.match(submit, /resetProjectForm\(\)/);
  assert.match(archive, /payload: \{ isActive: !project\.isActive \}/);
  assert.match(
    remove,
    /projectMutations\.removeProject\.mutateAsync\(project\.id\)/
  );
});

test('Projetos reaproveita o card DS e mantém formulários e revisões isolados', () => {
  const page = source('src/pages/gestor/GestorPage.tsx');
  const pendingReview = source('src/pages/gestor/PendingProjectReviewForm.tsx');
  const revisionPicker = source(
    'src/components/projects/ProjectRevisionPicker.tsx'
  );
  const projectCard = sectionBetween(
    page,
    'function renderProjectCard',
    'export function GestorPage'
  );
  const projectsTab = sectionBetween(
    page,
    'function renderProjectsTab',
    'function renderArchivedProjectsTab'
  );

  assert.match(
    projectCard,
    /const activeProject = project\.isActive !== false/
  );
  assert.match(
    projectCard,
    /className=\{`rdo-project-card rdo-archived-project-card/
  );
  assert.match(
    projectCard,
    /data-active-project-id=\{activeProject \? project\.id : undefined\}/
  );
  assert.match(projectCard, /Projeto aguardando revisão/);
  assert.match(projectCard, /Projeto ativo/);
  assert.match(projectCard, /Projeto arquivado/);
  assert.match(projectCard, /label=\{stateLabel\}/);
  assert.match(projectCard, /\{activeProject \? 'Arquivar' : 'Desarquivar'\}/);
  assert.match(projectCard, /<dl>[\s\S]*?<dt>[\s\S]*?<dd>/);

  assert.match(projectsTab, /<PendingProjectReviewForm\b/);
  assert.match(
    projectsTab,
    /<form className="admin-inline-form admin-inline-grid"/
  );
  assert.match(projectsTab, /className="rdo-manager-projects__legacy-form"/);
  assert.match(projectCard, /<ProjectRevisionPicker projectId=\{project\.id\}/);

  assert.match(
    projectsTab,
    /<Button variant="primary" type="submit" disabled=\{projectMutations\.updateProject\.isPending\}>Salvar projeto<\/Button>/
  );
  assert.match(
    projectsTab,
    /<Button variant="secondary" size="sm" type="button" onClick=\{resetProjectForm\}>Cancelar edição<\/Button>/
  );
  assert.equal(
    page.match(
      /<Button variant="primary" size="sm" type="button"[^>]*>[\s\S]*?\+ Adicionar[\s\S]*?<\/Button>/g
    )?.length,
    2
  );
  assert.equal(
    projectsTab.match(
      /<Button variant="secondary" size="sm" type="button" onClick=\{openSegmentForm\}>\+ Adicionar segmento<\/Button>/g
    )?.length,
    2
  );
  assert.match(
    projectsTab,
    /<Button variant="primary" type="submit" disabled=\{projectMutations\.createProject\.isPending\}>Criar projeto<\/Button>/
  );

  assert.doesNotMatch(revisionPicker, /mini-btn/);
  assert.match(
    revisionPicker,
    /<Button[\s\S]*?variant="primary"[\s\S]*?size="sm"[\s\S]*?mutation\.isPending[\s\S]*?Aplicar/
  );
  assert.match(
    revisionPicker,
    /<Button[\s\S]*?variant="secondary"[\s\S]*?size="sm"[\s\S]*?removeAdditionalMutation\.isPending[\s\S]*?Remover/
  );
  assert.doesNotMatch(pendingReview, /mini-btn/);
  assert.match(
    pendingReview,
    /<Button variant="primary" type="submit" disabled=\{saving\}>Confirmar e salvar<\/Button>/
  );
  assert.match(
    pendingReview,
    /<Button variant="secondary" size="sm" type="button" onClick=\{onCancel\}>Cancelar revisão<\/Button>/
  );
});

test('Projetos compartilha o layout de Arquivados com CSS escopado e responsivo', () => {
  const css = source('src/pages/gestor/GestorPage.ds.css');
  const cssStart = css.indexOf('Projetos arquivados');
  const cssEnd = css.indexOf('RDO B.11', cssStart);

  assert.ok(cssStart >= 0, 'bloco compartilhado de projetos ausente');
  assert.ok(cssEnd > cssStart, 'limite do bloco compartilhado ausente');
  const block = css.slice(cssStart, cssEnd);

  assert.match(
    block,
    /\.rdo-manager-projects-page,\s*:where\(\.fv-ds, \[data-fv-ds\]\)\.rdo-manager-archived-page/
  );
  assert.match(block, /\.rdo-manager-projects__filters/);
  assert.match(block, /\.rdo-manager-projects__toolbar/);
  assert.match(block, /\.rdo-manager-projects__pending/);
  assert.match(block, /\.rdo-active-project-card__identity/);
  assert.match(block, /\.rdo-manager-projects__legacy-form/);
  assert.match(block, /@media \(min-width: 768px\)/);
  assert.match(block, /@media \(max-width: 480px\)/);
  assert.match(block, /var\(--/);
  assert.doesNotMatch(block, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(block, /\brgba?\(/i);
  assert.doesNotMatch(block, /!important/);
});
