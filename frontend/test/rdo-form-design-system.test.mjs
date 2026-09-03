import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('formulário de RDO usa o shell e os componentes do design system', () => {
  const page = source('src/pages/collaborator/NewReportPage.tsx');

  assert.match(page, /<AppShell\b/);
  assert.match(page, /<PageHeader\b/);
  assert.match(page, /className="fv-ds rdo-form-page"/);
  assert.match(page, /<ProgressSteps\b/);
  assert.match(page, /<Card\b/);
  assert.match(page, /<Button\b/);
  assert.match(page, /<Switch\b/);
  assert.match(page, /appearance="design-system"/);
  assert.doesNotMatch(page, /<Shell\b|<TopBar\b/);
  assert.doesNotMatch(page, /[🧪🔴🔵💧⚙️🛡️]/u);
});

test('aparência de uploads e campos de serviço é opt-in e preserva consumidores legados', () => {
  const page = source('src/pages/collaborator/NewReportPage.tsx');
  const serviceFields = source('src/components/reports/ServiceFields.tsx');
  const upload = source('src/components/ui/UploadField.tsx');

  assert.match(page, /<ServiceFields[\s\S]*?appearance="design-system"/);
  assert.match(page, /<UploadField[\s\S]*?appearance="design-system"/);
  assert.match(serviceFields, /appearance = 'legacy'/);
  assert.match(upload, /appearance = 'legacy'/);
});

test('CSS do formulário é escopado, tokenizado e cobre os breakpoints oficiais', () => {
  const css = source('src/pages/collaborator/NewReportPage.css');

  assert.match(css, /\.fv-ds\.rdo-form-page/);
  assert.match(css, /var\(--content-max\)/);
  assert.match(css, /@media \(max-width: 767\.98px\)/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(min-width: 1280px\)/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\brgba?\(/i);
  assert.doesNotMatch(css, /!important/);
});

test('stepper e switch são primitivos exportados pelo barrel do DS', () => {
  const barrel = source('src/components/ui/ds/index.ts');
  const stepper = source('src/components/ui/ds/ProgressSteps.tsx');
  const switchSource = source('src/components/ui/ds/Switch.tsx');

  assert.match(barrel, /ProgressSteps/);
  assert.match(barrel, /Switch/);
  assert.match(stepper, /aria-current/);
  assert.match(stepper, /aria-disabled/);
  assert.match(switchSource, /type="checkbox"/);
  assert.match(switchSource, /htmlFor=\{controlId\}/);
});

test('campos de serviço mantêm agrupamento temático e leituras responsivas', () => {
  const page = source('src/pages/collaborator/NewReportPage.tsx');
  const serviceFields = source('src/components/reports/ServiceFields.tsx');
  const css = source('src/pages/collaborator/NewReportPage.css');

  assert.match(page, /aria-label="Equipamento e sistema"/);
  assert.match(page, /aria-label="Equipe do serviço"/);
  assert.match(page, /aria-label="Horários do serviço"/);
  assert.match(serviceFields, /<ServiceFormSection title="Análises complementares"/);
  assert.match(serviceFields, /role="group" aria-label="Leituras NAS"/);
  assert.match(serviceFields, /role="group" aria-label="Leituras ISO"/);
  assert.match(serviceFields, /role="group" aria-label="Leituras de umidade"/);
  assert.match(serviceFields, /service-notes-field service-options-full/);
  assert.match(css, /\.rdo-form-page \.tube-row-react \{/);
  assert.match(css, /\.rdo-form-page \.service-notes-field textarea \{/);
});

test('agrupamento temático fica plano e compacto apenas no mobile', () => {
  const css = source('src/pages/collaborator/NewReportPage.css');
  const mobileStart = css.indexOf('@media (max-width: 767.98px)');
  const mobileEnd = css.indexOf('@media (min-width: 768px)', mobileStart);
  const mobileBlock = css.slice(mobileStart, mobileEnd);

  assert.ok(mobileStart >= 0 && mobileEnd > mobileStart);
  assert.match(mobileBlock, /\.rdo-form-page \.report-services-step,[\s\S]*?padding: var\(--space-3\)/);
  assert.match(mobileBlock, /\.rdo-form-page \.rdo-service-section \{[\s\S]*?padding: 0/);
  assert.match(mobileBlock, /border: 0/);
  assert.match(mobileBlock, /background: transparent/);
});

test('upload de PDF e foco dos campos preservam contraste e contorno', () => {
  const css = source('src/pages/collaborator/NewReportPage.css');
  const legacyCss = source('src/styles/base.css');

  assert.match(legacyCss, /\.dark \.pdf-dropzone \{/);
  assert.match(legacyCss, /\.dark \.pdf-dropzone\.has-file \{/);
  assert.match(css, /\.fv-ds\.rdo-form-page \.report-services-step/);
  assert.match(css, /overflow: visible/);
  assert.match(css, /min-height: calc\(var\(--space-10\) - var\(--space-1\)\)/);
});
