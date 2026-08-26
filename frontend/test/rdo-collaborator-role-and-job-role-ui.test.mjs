import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('equipe do RDO mostra o cargo canônico abaixo do nome do colaborador', () => {
  const page = read('../src/pages/collaborator/NewReportPage.tsx');
  const css = read('../src/styles/base.css');

  assert.match(page, /item\?\.jobRole\?\.name \|\| item\?\.role/);
  assert.match(page, /className="colab-tag-copy"/);
  assert.match(page, /className="colab-tag-role">\{roleName\}<\/small>/);
  assert.match(css, /\.colab-tag-copy\s*\{[^}]*flex-direction:\s*column/s);
});

test('função operacional fica apenas nos formulários de criação e edição do cargo', () => {
  const manager = read('../src/components/projects/JobRoleManager.tsx');
  const api = read('../src/api/jobRoles.ts');

  assert.doesNotMatch(manager, />Renomear</);
  assert.match(manager, />\s*Editar\s*<\/button>/);
  assert.equal((manager.match(/className="tog-row job-role-operational-field"/g) || []).length, 2);
  assert.equal((manager.match(/className="tog-sl"/g) || []).length, 2);
  assert.match(manager, /setNewIsOperational\(event\.target\.checked\)/);
  assert.match(manager, /setEditing\(\{ \.\.\.editing, isOperational: event\.target\.checked \}\)/);
  assert.match(api, /createJobRole\(payload: \{ name: string; isOperational\?: boolean \}\)/);
});
