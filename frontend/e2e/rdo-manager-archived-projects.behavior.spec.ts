import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  demoCredentials,
  expectComfortableTapTargets,
  expectManagerRdoShell,
  loginAs
} from './support/rdo';

const MANAGER_ARCHIVED_URL = '/rdo/gestor?tab=arquivados';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function setTheme(page: Page, theme: 'light' | 'dark') {
  const toggle = page.locator('.fv-theme-toggle').first();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    if (current === theme) return;
    await toggle.click();
  }
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    )
    .toBe(theme);
}

async function expectNoHorizontalOverflow(page: Page, surface: Locator) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          document.body.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true);
  await expect
    .poll(() =>
      surface.evaluate((element) => element.scrollWidth <= element.clientWidth)
    )
    .toBe(true);
}

async function openArchivedPage(page: Page) {
  await page.goto(MANAGER_ARCHIVED_URL);
  await expect(
    page.getByRole('heading', { name: 'Projetos arquivados', level: 1 })
  ).toBeVisible();
  const surface = page.locator('.rdo-archived-projects');
  await expect(surface).toBeVisible();
  return surface;
}

async function projectWithReports(surface: Locator) {
  const candidate = surface
    .locator(
      '.rdo-archived-project-card:has(.rdo-archived-report-type__toggle)'
    )
    .first();
  await expect(
    candidate,
    'O backend real precisa fornecer um projeto arquivado com relatório carregado'
  ).toBeVisible();
  const projectId = await candidate.getAttribute('data-archived-project-id');
  expect(projectId).toBeTruthy();
  return surface.locator(`[data-archived-project-id="${projectId}"]`);
}

test('Arquivados preserva busca, agrupamentos, seleção e ações sem mutar dados', async ({
  page
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, demoCredentials.manager);
  const surface = await openArchivedPage(page);
  await expectManagerRdoShell(page);

  const mutationAttempts: string[] = [];
  page.on('request', (request) => {
    if (MUTATING_METHODS.has(request.method().toUpperCase())) {
      mutationAttempts.push(`${request.method()} ${request.url()}`);
    }
  });

  await expect(surface.locator('.rdo-archived-project-card')).not.toHaveCount(
    0
  );
  const project = await projectWithReports(surface);
  const projectToggle = project.locator('.rdo-archived-project-card__toggle');
  const reportRegionId = await projectToggle.getAttribute('aria-controls');
  expect(reportRegionId).toBeTruthy();
  await expect(projectToggle).toHaveAttribute('aria-expanded', 'true');

  await projectToggle.click();
  await expect(projectToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(
    project.locator('.rdo-archived-report-type__toggle')
  ).toHaveCount(0);
  await projectToggle.click();
  await expect(projectToggle).toHaveAttribute('aria-expanded', 'true');

  const typeToggle = project
    .locator('.rdo-archived-report-type__toggle')
    .first();
  await expect(typeToggle).toHaveAttribute('aria-expanded', 'true');
  await typeToggle.click();
  await expect(typeToggle).toHaveAttribute('aria-expanded', 'false');
  await typeToggle.click();
  await expect(typeToggle).toHaveAttribute('aria-expanded', 'true');

  const detailsToggle = project.getByRole('button', {
    name: /^(Mostrar|Ocultar) detalhes$/
  });
  if ((await detailsToggle.getAttribute('aria-expanded')) === 'true') {
    await detailsToggle.click();
    await expect(
      project.getByRole('button', { name: 'Mostrar detalhes', exact: true })
    ).toHaveAttribute('aria-expanded', 'false');
  }
  await project
    .getByRole('button', { name: 'Mostrar detalhes', exact: true })
    .click();
  await expect(
    project.getByRole('button', { name: 'Ocultar detalhes', exact: true })
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(
    project.locator('.rdo-archived-project-card__details dl')
  ).toBeVisible();

  const reportCheckbox = project
    .getByRole('checkbox', { name: /^Selecionar (?!todos)/ })
    .first();
  await reportCheckbox.check();
  const batchToolbar = project
    .locator('.rdo-manager-listing__batch-toolbar')
    .first();
  await expect(batchToolbar).toBeVisible();
  await expect(batchToolbar.getByText(/selecionado\(s\)/)).toBeVisible();
  await expect(
    batchToolbar.getByRole('button', { name: 'Baixar PDF', exact: true })
  ).toBeVisible();
  await expect(
    batchToolbar.getByRole('button', { name: 'Baixar DOCX', exact: true })
  ).toBeVisible();

  const sortButton = surface.getByRole('button', {
    name: 'Ordenar projetos de Z a A',
    exact: true
  });
  await sortButton.click();
  await expect(
    surface.getByRole('button', {
      name: 'Ordenar projetos de A a Z',
      exact: true
    })
  ).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Buscar em arquivados' });
  await search.fill('projeto-inexistente-b12');
  await expect(
    surface.getByText('Nenhum projeto arquivado encontrado.', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await expect(surface.locator('.rdo-archived-project-card')).not.toHaveCount(
    0
  );

  expect(mutationAttempts).toEqual([]);
  await expect(page).toHaveURL(/\/rdo\/gestor\?tab=arquivados$/);
});

test('Arquivados valida desktop/mobile em light/dark sem overflow', async ({
  page
}) => {
  test.setTimeout(180_000);
  const scenarios = [
    {
      name: 'desktop light',
      width: 1280,
      height: 900,
      theme: 'light' as const
    },
    { name: 'desktop dark', width: 1280, height: 900, theme: 'dark' as const },
    { name: 'mobile light', width: 390, height: 844, theme: 'light' as const },
    { name: 'mobile dark', width: 390, height: 844, theme: 'dark' as const }
  ];

  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, demoCredentials.manager);
  const surface = await openArchivedPage(page);
  const project = await projectWithReports(surface);

  for (const scenario of scenarios) {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height
    });
    if (scenario.width >= 1024) {
      await expectManagerRdoShell(page);
    } else {
      await expect(page.locator('[data-testid="fv-app-shell"]')).toBeVisible();
      await expect(page.locator('.fv-sidebar')).toBeHidden();
      await expect(page.locator('.fv-topbar')).toBeVisible();
      await expect(page.locator('.fv-theme-toggle')).toBeVisible();
      await expect(page.locator('.rdo-manager-tabs-wrap')).toBeVisible();
    }
    await setTheme(page, scenario.theme);

    await expectNoHorizontalOverflow(page, surface);
    await expectComfortableTapTargets(page, '.rdo-archived-projects');
    await expect(project).toHaveCSS(
      'background-color',
      scenario.theme === 'dark' ? 'rgb(22, 33, 27)' : 'rgb(255, 255, 255)'
    );
    await expect(surface).not.toHaveClass(/(?:^|\s)page-card(?:\s|$)/);
    await expect(
      surface.locator(
        ':scope > .rdo-archived-projects__list > .admin-card, ' +
          '.rdo-archived-project-card > .fv-card__footer .mini-btn, ' +
          '.rdo-archived-projects__toolbar .secondary-button, ' +
          '.rdo-archived-report-type > .report-type-header, ' +
          '.rdo-archived-report-type .rtype-badge'
      )
    ).toHaveCount(0);

    if (scenario.width >= 768) {
      await expect(
        project.locator('.fv-data-table__desktop').first()
      ).toBeVisible();
      await expect(
        project.locator('.fv-data-table__mobile').first()
      ).toBeHidden();
    } else {
      await expect(
        project.locator('.fv-data-table__desktop').first()
      ).toBeHidden();
      await expect(
        project.locator('.fv-data-table__mobile').first()
      ).toBeVisible();
    }
  }
});
