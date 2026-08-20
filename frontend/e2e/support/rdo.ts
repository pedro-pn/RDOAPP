import { expect, type Page } from '@playwright/test';

type DemoCredentials = {
  username: string;
  password: string;
};

export const demoCredentials = {
  manager: {
    username: process.env.RDO_E2E_MANAGER_USERNAME ?? 'gestor',
    password: process.env.RDO_E2E_MANAGER_PASSWORD ?? 'gestor123'
  },
  collaborator: {
    username: process.env.RDO_E2E_COLLABORATOR_USERNAME ?? 'colaborador1',
    password: process.env.RDO_E2E_COLLABORATOR_PASSWORD ?? 'colab123'
  },
  client: {
    username: process.env.RDO_E2E_CLIENT_USERNAME ?? '12345678000190',
    password: process.env.RDO_E2E_CLIENT_PASSWORD ?? '123456'
  }
} satisfies Record<string, DemoCredentials>;

export async function loginAs(page: Page, credentials: DemoCredentials) {
  await page.goto('/login');

  await page
    .getByRole('textbox', { name: 'Usuário', exact: true })
    .fill(credentials.username);
  await page
    .getByRole('textbox', { name: 'Senha', exact: true })
    .fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).not.toHaveURL(/\/login(?:\?.*)?$/);
}

export async function expectLegacyRdoShell(page: Page) {
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('[data-testid="fv-app-shell"]')).toHaveCount(0);
  await expect(page.locator('.fv-sidebar')).toHaveCount(0);
  await expect(page.locator('.fv-navigation-drawer')).toHaveCount(0);
  await expect(page.locator('.fv-bottom-bar')).toHaveCount(0);
  await expect(page.locator('.fv-theme-toggle')).toHaveCount(0);
}

export async function expectManagerRdoShell(page: Page) {
  await expect(page.locator('[data-testid="fv-app-shell"]')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCount(0);
  await expect(page.locator('.fv-sidebar')).toBeVisible();
  await expect(page.locator('.fv-topbar')).toBeVisible();
  await expect(page.locator('.fv-theme-toggle')).toBeVisible();
  await expect(page.locator('.rdo-manager-tabs-wrap')).toBeVisible();
}

export async function logoutFromRdo(page: Page) {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
}
