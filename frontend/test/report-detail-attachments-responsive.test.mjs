import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('anexos do detalhe exibem nome como link separado da miniatura', () => {
  const page = source('src/pages/ReportDetailPage.tsx');

  assert.match(page, /className="report-upload-link"/);
  assert.match(page, /aria-label=\{`Abrir \$\{displayName\}`\}/);
  assert.match(page, /className="report-upload-name">\{displayName\}<\/span>/);
  assert.match(page, /className="upload-thumbs report-upload-list"/);
});

test('anexos viram linhas legíveis e sem sobreposição no mobile', () => {
  const css = source('src/styles/base.css');
  const responsiveStart = css.indexOf(
    '@media (max-width: 767.98px)',
    css.indexOf('.report-upload-link')
  );
  const responsiveBlock = css.slice(responsiveStart, css.indexOf('}', css.indexOf('.report-upload-name', responsiveStart)) + 1);

  assert.match(css, /\.report-upload-name \{[\s\S]*?text-decoration: underline/);
  assert.match(responsiveBlock, /\.report-upload-list \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(
    responsiveBlock,
    /\.report-upload-link \{[\s\S]*?grid-template-columns: 72px minmax\(0, 1fr\)/
  );
  assert.match(responsiveBlock, /gap: 12px/);
  assert.doesNotMatch(responsiveBlock, /position:\s*absolute/);
});

test('imagens existentes no editor separam miniatura e link no mobile', () => {
  const upload = source('src/components/ui/UploadField.tsx');
  const baseCss = source('src/styles/base.css');
  const formCss = source('src/pages/collaborator/NewReportPage.css');
  const mobileStart = formCss.indexOf('@media (max-width: 767.98px)');
  const mobileEnd = formCss.indexOf('@media (min-width: 768px)', mobileStart);
  const mobileBlock = formCss.slice(mobileStart, mobileEnd);

  assert.match(upload, /className="upload-list-preview"/);
  assert.match(upload, /<img className="upload-list-thumb" src=\{href\} alt=""/);
  assert.match(baseCss, /a\.upload-list-name \{[\s\S]*?text-decoration: underline/);
  assert.match(formCss, /\.rdo-form-page a\.upload-list-name \{[\s\S]*?color: var\(--bl\)/);
  assert.match(
    mobileBlock,
    /\.upload-list-item \{[\s\S]*?grid-template-columns: var\(--space-12\) minmax\(0, 1fr\) auto/
  );
  assert.match(
    mobileBlock,
    /\.upload-list-name \{[\s\S]*?white-space: normal;[\s\S]*?overflow-wrap: anywhere/
  );
});
