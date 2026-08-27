import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createServer } from 'vite';

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadModule(path) {
  const server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    return await server.ssrLoadModule(path);
  } finally {
    await server.close();
  }
}

test('navigation model receives only modules already resolved by existing access rules', async () => {
  const { hubModulesForUser } = await loadModule('/src/pages/hubModules.ts');
  const { createNavigationModel } = await loadModule(
    '/src/layout/navigationModel.ts'
  );
  const user = {
    role: 'COLLABORATOR',
    accountType: 'INTERNAL',
    moduleRoles: ['rdo:collaborator', 'estoque:viewer']
  };
  const resolvedModules = hubModulesForUser(user);
  const navigation = createNavigationModel({
    modules: resolvedModules,
    pathname: '/estoque'
  });
  const moduleItems = navigation.groups.find(
    (group) => group.id === 'modules'
  ).items;

  assert.deepEqual(
    moduleItems.map((item) => item.id),
    resolvedModules.map((module) => module.id)
  );
  assert.equal(moduleItems.find((item) => item.id === 'estoque').active, true);
  assert.equal(
    moduleItems.some((item) => item.id === 'admin'),
    false
  );
});

test('navigation model expands the active RDO module with its real secondary routes', async () => {
  const { createNavigationModel } = await loadModule(
    '/src/layout/navigationModel.ts'
  );
  const model = createNavigationModel({
    modules: [
      {
        id: 'rdo',
        title: 'Relatórios e Projetos',
        copy: 'Gestão de relatórios',
        path: '/rdo/gestor'
      }
    ],
    pathname: '/rdo/gestor',
    subNavigation: {
      parentId: 'rdo',
      items: [
        {
          id: 'pendentes',
          label: 'Pendentes',
          href: '/rdo/gestor',
          active: false
        },
        {
          id: 'projetos',
          label: 'Projetos',
          href: '/rdo/gestor?tab=projetos',
          active: true
        }
      ]
    }
  });
  const rdo = model.groups
    .find((group) => group.id === 'modules')
    .items.find((item) => item.id === 'rdo');

  assert.equal(rdo.active, true);
  assert.equal(rdo.expanded, true);
  assert.equal(rdo.children.length, 2);
  assert.equal(rdo.children.find((item) => item.active).id, 'projetos');
});

test('all navigation surfaces consume the shared NavigationModel', () => {
  for (const file of [
    'src/layout/Sidebar.tsx',
    'src/layout/NavigationDrawer.tsx',
    'src/layout/BottomBar.tsx'
  ]) {
    assert.match(source(file), /NavigationModel/);
  }

  assert.match(source('src/layout/Sidebar.tsx'), /<NavigationList/);
  assert.match(source('src/layout/NavigationDrawer.tsx'), /<Sidebar/);
  assert.match(
    source('src/layout/BottomBar.tsx'),
    /navigationItems\(navigation\)/
  );

  const navigationList = source('src/layout/NavigationList.tsx');
  assert.match(navigationList, /aria-expanded=/);
  assert.match(navigationList, /fv-navigation-submenu/);
  assert.match(navigationList, /aria-current=\{child\.active \? 'page'/);
});

test('desktop sidebar stays in the viewport and owns its vertical scroll', () => {
  const css = source('src/layout/AppShell.css');

  assert.match(
    css,
    /\.fv-app-shell__sidebar\s*\{[\s\S]*position:\s*(?:sticky|fixed)/
  );
  assert.match(
    css,
    /\.fv-app-shell__sidebar\s*\{[\s\S]*inset-block-start:\s*0/
  );
  assert.match(css, /\.fv-app-shell__sidebar\s*\{[\s\S]*height:\s*100dvh/);
  assert.match(css, /\.fv-sidebar__navigation\s*\{[\s\S]*overflow-y:\s*auto/);
});

test('AppShell keeps contained content by default and lets RDO opt into desktop fluid width', () => {
  const shell = source('src/layout/AppShell.tsx');
  const css = source('src/layout/AppShell.css');
  const manager = source('src/pages/gestor/GestorPage.tsx');
  const hub = source('src/pages/HubPage.tsx');

  assert.match(shell, /contentWidth = 'contained'/);
  assert.match(shell, /fv-app-shell__content-inner--\$\{contentWidth\}/);
  assert.match(
    css,
    /\.fv-app-shell__content-inner--fluid\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*none/
  );
  assert.match(manager, /contentWidth="fluid"/);
  assert.doesNotMatch(hub, /contentWidth="fluid"/);
});

test('new shell styles use semantic tokens and only official breakpoints', () => {
  const css = `${source('src/layout/AppShell.css')}\n${source(
    'src/dev/shell-design-system.css'
  )}`;

  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\brgba?\(/i);
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /@(media|container)[^{]*(430|560|640|860)px/);
  for (const breakpoint of ['480px', '768px', '1024px', '1280px']) {
    assert.match(css, new RegExp(breakpoint));
  }
});

test('legacy TopBar and BottomBar APIs remain available as the default branch', () => {
  const topBar = source('src/layout/TopBar.tsx');
  const bottomBar = source('src/layout/BottomBar.tsx');

  assert.match(topBar, /appearance\?: 'legacy'/);
  assert.match(topBar, /props\.appearance === 'design-system'/);
  assert.match(topBar, /className="topbar-react"/);
  assert.match(bottomBar, /appearance\?: 'legacy'/);
  assert.match(bottomBar, /className="bottom-bar-react"/);
});

test('design-system TopBar restores the adaptive brand while the sidebar is hidden', () => {
  const topBar = source('src/layout/TopBar.tsx');
  const css = source('src/layout/AppShell.css');
  const designSystemTopBar = topBar.slice(
    topBar.indexOf('function DesignSystemTopBar'),
    topBar.indexOf('export function TopBar')
  );

  assert.match(
    topBar,
    /<BrandLogo variant="adaptive" className="fv-topbar__brand" \/>/
  );
  assert.ok(
    designSystemTopBar.indexOf('className="fv-topbar__menu"') <
      designSystemTopBar.indexOf('<BrandLogo'),
    'o acionador do menu deve vir antes da marca no header mobile'
  );
  assert.match(
    css,
    /\.fv-topbar \.fv-topbar__brand\s*\{[\s\S]*height:\s*var\(--space-6\)/
  );
  assert.match(
    css,
    /@media \(min-width: 1024px\)[\s\S]*\.fv-topbar \.fv-topbar__brand\s*\{[\s\S]*display:\s*none/
  );
});

test('shell harness is isolated from application routes and simulates no permissions', () => {
  const html = source('shell-design-system.html');
  const entry = source('src/dev/shell-design-system-main.tsx');
  const page = source('src/dev/ShellDesignSystemPage.tsx');

  assert.match(html, /src="\/src\/dev\/shell-design-system-main\.tsx"/);
  assert.match(html, /noindex,nofollow/);
  assert.match(entry, /<MemoryRouter/);
  assert.match(page, /moduleRegistry/);
  assert.doesNotMatch(page, /moduleRoles\s*:/);
  assert.doesNotMatch(
    source('src/App.tsx'),
    /shell-design-system|design-system-shell/
  );
});

test('drawer preserves modal accessibility and focus behavior', () => {
  const drawer = source('src/layout/NavigationDrawer.tsx');

  assert.match(drawer, /aria-modal="true"/);
  assert.match(drawer, /event\.key === 'Escape'/);
  assert.match(drawer, /event\.key !== 'Tab'/);
  assert.match(drawer, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(drawer, /previousFocusRef\.current\?\.focus\(\)/);
  assert.match(drawer, /createPortal\(/);
});

test('new AppShell is enabled by Hub and the manager RDO pilot only', () => {
  const hub = source('src/pages/HubPage.tsx');
  const manager = source('src/pages/gestor/GestorPage.tsx');
  const collaborator = source('src/pages/collaborator/MyReportsPage.tsx');
  const legacyShell = source('src/layout/Shell.tsx');

  assert.match(hub, /import \{ AppShell \}/);
  assert.match(hub, /<AppShell/);
  assert.doesNotMatch(hub, /import \{ Shell \}/);
  assert.match(manager, /import \{ AppShell \}/);
  assert.match(manager, /<AppShell/);
  assert.doesNotMatch(manager, /import \{ Shell \}/);
  assert.match(collaborator, /import \{ Shell \}/);
  assert.doesNotMatch(collaborator, /import \{ AppShell \}/);
  assert.match(legacyShell, /className="app-shell"/);
});
