import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  demoCredentials,
  expectComfortableTapTargets,
  expectManagerRdoMobileNavigation,
  expectManagerRdoShell,
  loginAs
} from './support/rdo';

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

test('Equipe e Usuários preservam navegação, busca e formulários sem mutar dados', async ({
  page
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, demoCredentials.manager);

  const mutationAttempts: string[] = [];
  page.on('request', (request) => {
    const isReadOnlyCountQuery = request
      .url()
      .endsWith('/api/rdo/reports/counts');
    if (
      MUTATING_METHODS.has(request.method().toUpperCase()) &&
      !isReadOnlyCountQuery
    ) {
      mutationAttempts.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('/rdo/gestor?tab=equipe');
  await expectManagerRdoShell(page);
  await expect(
    page.getByRole('heading', { name: 'Equipe', level: 1 })
  ).toBeVisible();
  await expect(page.locator('.fv-metric-card')).toHaveCount(4);
  const teamTabs = page.getByRole('tablist', { name: 'Seções da equipe' });
  await expect(teamTabs.getByRole('tab')).toHaveCount(3);
  await expect(
    teamTabs.getByRole('tab', { name: 'Colaboradores' })
  ).toHaveAttribute('aria-selected', 'true');

  const teamSearch = page.getByRole('searchbox', { name: 'Buscar na equipe' });
  await teamSearch.fill('colaborador-inexistente-rdo');
  await expect(
    page.getByText('Nenhum colaborador ativo.', { exact: true })
  ).toBeVisible();
  await teamSearch.fill('');

  await teamTabs.getByRole('tab', { name: 'Cargos' }).click();
  await expect(teamTabs.getByRole('tab', { name: 'Cargos' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(teamSearch).toBeVisible();
  await teamSearch.fill('cargo-inexistente-rdo');
  await expect(
    page.getByText('Nenhum cargo encontrado.', { exact: true })
  ).toBeVisible();
  await teamSearch.fill('');
  await page.getByRole('button', { name: 'Novo cargo', exact: true }).click();
  await expect(page.getByLabel('Nome do cargo')).toBeFocused();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Novo cargo', exact: true })
  ).toBeFocused();
  await teamTabs.getByRole('tab', { name: 'Temas de DDS' }).click();
  await expect(
    teamTabs.getByRole('tab', { name: 'Temas de DDS' })
  ).toHaveAttribute('aria-selected', 'true');
  await teamSearch.fill('tema-inexistente-rdo');
  await expect(
    page.getByText('Nenhum tema de DDS encontrado.', { exact: true })
  ).toBeVisible();
  await teamSearch.fill('');
  await page.getByRole('button', { name: 'Novo tema', exact: true }).click();
  await expect(page.getByLabel('Nome do tema')).toBeFocused();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Novo tema', exact: true })
  ).toBeFocused();
  await teamTabs.getByRole('tab', { name: 'Colaboradores' }).click();

  await page.getByRole('button', { name: /Novo colaborador$/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Novo colaborador' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.goto('/rdo/gestor?tab=usuarios');
  await expect(
    page.getByRole('heading', { name: 'Usuários', level: 1 })
  ).toBeVisible();
  await expect(page.locator('.fv-metric-card')).toHaveCount(3);
  const userTabs = page.getByRole('tablist', { name: 'Tipo de usuário' });
  await expect(userTabs.getByRole('tab')).toHaveCount(2);

  const userSearch = page.getByRole('searchbox', {
    name: 'Buscar em usuários'
  });
  await userSearch.fill('usuario-inexistente-rdo');
  await expect(
    page.getByText('Nenhum usuário interno cadastrado.', { exact: true })
  ).toBeVisible();
  await userSearch.fill('');

  await userTabs.getByRole('tab', { name: 'Clientes' }).click();
  const clientGroup = page.locator('.rdo-client-account-group').first();
  await expect(clientGroup).toBeVisible();
  const groupToggle = clientGroup.locator('.client-account-group-toggle');
  await expect(groupToggle).toHaveAttribute('aria-expanded', 'true');
  await groupToggle.click();
  await expect(groupToggle).toHaveAttribute('aria-expanded', 'false');
  await groupToggle.click();

  await userTabs.getByRole('tab', { name: 'Internos' }).click();
  await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Novo usuário' })
  ).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute(
    'type',
    'password'
  );
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  expect(mutationAttempts).toEqual([]);
});

test('Equipe e Usuários mantêm light/dark e desktop/mobile sem overflow', async ({
  page
}) => {
  test.setTimeout(180_000);
  await loginAs(page, demoCredentials.manager);

  const scenarios = [
    { width: 1280, height: 900, theme: 'light' as const },
    { width: 1280, height: 900, theme: 'dark' as const },
    { width: 390, height: 844, theme: 'light' as const },
    { width: 390, height: 844, theme: 'dark' as const }
  ];

  for (const scenario of scenarios) {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height
    });

    for (const section of ['equipe', 'usuarios'] as const) {
      await page.goto(`/rdo/gestor?tab=${section}`);
      await setTheme(page, scenario.theme);
      const surface = page.locator('.rdo-manager-admin-page');
      await expect(surface).toBeVisible();
      await expectNoHorizontalOverflow(page, surface);
      await expect(surface.locator('.mini-btn')).toHaveCount(0);

      if (scenario.width < 1024) {
        await expectManagerRdoMobileNavigation(page);
        await expectComfortableTapTargets(page, '.rdo-manager-admin-page');
      } else {
        await expectManagerRdoShell(page);
      }
    }
  }
});
