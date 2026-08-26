import { expect, test } from '@playwright/test';

import {
  demoCredentials,
  expectManagerRdoMobileNavigation,
  expectManagerRdoShell,
  loginAs
} from './support/rdo';

const MANAGER_HOME = '/rdo/gestor';

test.describe('navegação compartilhada do RDO Gestor', () => {
  test('desktop expõe as oito áreas na sidebar e a mantém na viewport', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await loginAs(page, demoCredentials.manager);
    await page.goto(MANAGER_HOME);
    await expectManagerRdoShell(page);

    await expect(
      page.getByRole('tablist', { name: 'Seções do gestor' })
    ).toHaveCount(0);

    const sidebar = page.locator('.fv-sidebar');
    const parent = sidebar.getByRole('link', {
      name: /^Relatórios e Projetos/
    });
    const submenu = sidebar.getByRole('list', {
      name: 'Áreas de Relatórios e Projetos'
    });
    await expect(parent).toHaveAttribute('aria-expanded', 'true');
    await expect(submenu.getByRole('link')).toHaveCount(8);
    await expect(
      submenu.getByRole('link', { name: /^Pendentes/ })
    ).toHaveAttribute('aria-current', 'page');

    await submenu
      .getByRole('link', { name: 'Projetos', exact: true })
      .click();
    await expect(page).toHaveURL(/\/rdo\/gestor\?tab=projetos$/);
    await expect(
      submenu.getByRole('link', { name: 'Projetos', exact: true })
    ).toHaveAttribute('aria-current', 'page');

    const before = await sidebar.boundingBox();
    expect(before).not.toBeNull();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const after = await sidebar.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);
    await expect(sidebar).toHaveCSS('height', '520px');

    const scrollContract = await sidebar
      .locator('.fv-sidebar__navigation')
      .evaluate((element) => ({
        overflowY: window.getComputedStyle(element).overflowY,
        scrollable: element.scrollHeight > element.clientHeight
      }));
    expect(scrollContract).toEqual({ overflowY: 'auto', scrollable: true });
  });

  test('mobile usa o seletor compacto, preserva a rota e não cria overflow', async ({
    page
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, demoCredentials.manager);
    await page.goto(MANAGER_HOME);
    await expectManagerRdoMobileNavigation(page);

    const selector = page.getByRole('combobox', {
      name: 'Navegar nas áreas de Relatórios e Projetos'
    });
    await expect(selector).toHaveValue('pendentes');
    await expect(selector.locator('option')).toHaveCount(8);

    await selector.selectOption('arquivados');
    await expect(page).toHaveURL(/\/rdo\/gestor\?tab=arquivados$/);
    await expect(selector).toHaveValue('arquivados');
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      )
      .toBe(true);
  });
});
