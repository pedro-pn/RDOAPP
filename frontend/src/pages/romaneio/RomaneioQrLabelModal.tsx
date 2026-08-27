import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { RomaneioCatalogItem } from '../../api/romaneio';
import { Modal } from '../../components/ui/Modal';
import {
  buildRomaneioItemQrValue,
  paginateRomaneioQrLabels,
  ROMANEIO_QR_LABEL_SIZES,
  type RomaneioQrLabelSizeId
} from '../../utils/romaneioQr';

const assetsBaseUrl = (import.meta.env.VITE_ASSETS_BASE_URL || '').replace(/\/$/, '');
const brandLogoUrl = `${assetsBaseUrl}/assets/Logo/LOGO_COLORIDO.png`;

const labelSizeOptions = ROMANEIO_QR_LABEL_SIZES;

const previewNameMaximumFontCqw = 14 * 25.4 / 72 / 120 * 100;
const previewCodeMaximumFontCqw = 34 * 25.4 / 72 / 120 * 100;
const previewCodeMinimumFontCqw = 16 * 25.4 / 72 / 120 * 100;

function previewNameMinimumFontCqw(labelWidthMillimeters: number) {
  const scale = labelWidthMillimeters / labelSizeOptions[0].widthMillimeters;
  const minimumFontPt = Math.max(8 * scale, 5.5);
  return minimumFontPt * 25.4 / 72 / labelWidthMillimeters * 100;
}

function RomaneioQrLabelPreviewName({ name, labelWidthMillimeters }: { name: string; labelWidthMillimeters: number }) {
  const elementRef = useRef<HTMLElement>(null);
  const uppercaseName = name.toLocaleUpperCase('pt-BR');

  useLayoutEffect(() => {
    const element = elementRef.current;
    const label = element?.closest<HTMLElement>('.romaneio-qr-label');
    if (!element || !label) return;

    const fitName = () => {
      element.style.fontSize = `${previewNameMaximumFontCqw}cqw`;
      let currentFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
      const minimumFontSize = label.clientWidth * previewNameMinimumFontCqw(labelWidthMillimeters) / 100;
      while (element.scrollWidth > element.clientWidth && currentFontSize > minimumFontSize) {
        currentFontSize = Math.max(minimumFontSize, currentFontSize - 0.25);
        element.style.fontSize = `${currentFontSize.toFixed(2)}px`;
      }
    };

    fitName();
    const resizeObserver = new ResizeObserver(fitName);
    resizeObserver.observe(label);
    return () => resizeObserver.disconnect();
  }, [labelWidthMillimeters, uppercaseName]);

  return (
    <strong ref={elementRef} title={uppercaseName}>
      {uppercaseName}
    </strong>
  );
}

function RomaneioQrLabelPreviewCode({ code }: { code: string }) {
  const elementRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const label = element?.closest<HTMLElement>('.romaneio-qr-label');
    if (!element || !label) return;

    const fitCode = () => {
      element.style.fontSize = `${previewCodeMaximumFontCqw}cqw`;
      let currentFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
      const minimumFontSize = label.clientWidth * previewCodeMinimumFontCqw / 100;
      while (element.scrollWidth > element.clientWidth && currentFontSize > minimumFontSize) {
        currentFontSize = Math.max(minimumFontSize, currentFontSize - 0.25);
        element.style.fontSize = `${currentFontSize.toFixed(2)}px`;
      }
    };

    fitCode();
    const resizeObserver = new ResizeObserver(fitCode);
    resizeObserver.observe(label);
    return () => resizeObserver.disconnect();
  }, [code]);

  return (
    <span className="romaneio-qr-label-code" ref={elementRef} title={code}>
      {code}
    </span>
  );
}

interface RomaneioQrLabelModalProps {
  items: RomaneioCatalogItem[];
  categoryName?: string;
  onClose: () => void;
}

export function RomaneioQrLabelModal({ items, categoryName, onClose }: RomaneioQrLabelModalProps) {
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrSvgMarkupByItemId, setQrSvgMarkupByItemId] = useState<Record<string, string>>({});
  const [selectedLabelSizes, setSelectedLabelSizes] = useState<RomaneioQrLabelSizeId[]>(['large']);

  useEffect(() => {
    if (items.length === 0) return;

    let disposed = false;
    setQrSvgMarkupByItemId({});
    setIsGenerating(true);
    void import('@zxing/browser').then(({ BrowserQRCodeSvgWriter }) => {
      if (disposed) return;
      const writer = new BrowserQRCodeSvgWriter();
      const markups = Object.fromEntries(items.map(item => {
        const value = buildRomaneioItemQrValue(item.id);
        const qrCode = writer.write(value, 320, 320);
        qrCode.setAttribute('role', 'img');
        qrCode.setAttribute('aria-label', `QR code de ${item.name}`);
        return [item.id, qrCode.outerHTML];
      }));
      setQrSvgMarkupByItemId(markups);
      setError('');
      setIsGenerating(false);
    }).catch(() => {
      if (disposed) return;
      setQrSvgMarkupByItemId({});
      setError('Não foi possível gerar os QR codes selecionados.');
      setIsGenerating(false);
    });

    return () => {
      disposed = true;
    };
  }, [items]);

  const selectedSizeOptions = labelSizeOptions.filter(option => selectedLabelSizes.includes(option.id));
  const labelPages = paginateRomaneioQrLabels(items, selectedLabelSizes);
  const totalLabels = items.length * selectedSizeOptions.length;
  const firstPreviewPage = labelPages[0];
  const isBatch = Boolean(categoryName);
  const isReady = items.length > 0 && Object.keys(qrSvgMarkupByItemId).length === items.length;

  function toggleLabelSize(size: RomaneioQrLabelSizeId) {
    setSelectedLabelSizes(current => {
      const isSelected = current.includes(size);
      if (isSelected && current.length === 1) return current;
      const next = isSelected ? current.filter(value => value !== size) : [...current, size];
      return labelSizeOptions.filter(option => next.includes(option.id)).map(option => option.id);
    });
  }

  function printLabel() {
    if (!isReady || selectedSizeOptions.length === 0) return;

    const printMetrics = selectedSizeOptions.map(option => {
      const scale = option.widthMillimeters / labelSizeOptions[0].widthMillimeters;
      const scaledMm = (value: number, minimum = 0) => Math.max(value * scale, minimum).toFixed(2);
      return {
        option,
        scale,
        scaledMm,
        codeMaximumFontPt: Math.max(34 * scale, 17),
        codeMinimumFontPt: Math.max(16 * scale, 8),
        nameMaximumFontPt: Math.max(14 * scale, 7),
        nameMinimumFontPt: Math.max(8 * scale, 5.5)
      };
    });

    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) {
      setError('O navegador bloqueou a impressão. Permita pop-ups e tente novamente.');
      return;
    }

    const { document } = printWindow;
    document.title = '\u200B';
    const style = document.createElement('style');
    const sizeRules = printMetrics.map(({ option, scale, scaledMm, codeMaximumFontPt, nameMaximumFontPt }) => `
      .label[data-size="${option.id}"] {
        --label-width: ${option.widthMillimeters}mm;
        --label-height: ${option.heightMillimeters}mm;
        --label-padding: ${scaledMm(5)}mm;
        --border-inset: ${scaledMm(2, 0.9)}mm;
        --border-radius: ${scaledMm(3.2, 1.6)}mm;
        --content-gap: ${scaledMm(3)}mm;
        --qr-size: ${scaledMm(44)}mm;
        --qr-padding: ${scaledMm(1.5)}mm;
        --qr-radius: ${scaledMm(3, 1.4)}mm;
        --divider-width: ${scaledMm(0.35, 0.2)}mm;
        --brand-height: ${scaledMm(13)}mm;
        --logo-width: ${scaledMm(34)}mm;
        --logo-height: ${scaledMm(9)}mm;
        --caption-font: ${Math.max(5.4 * scale, 3.2).toFixed(1)}pt;
        --identity-gap: ${scaledMm(1.2)}mm;
        --code-padding-y: ${scaledMm(0.8)}mm;
        --code-padding-x: ${scaledMm(3)}mm;
        --code-font: ${codeMaximumFontPt.toFixed(1)}pt;
        --name-font: ${nameMaximumFontPt.toFixed(1)}pt;
      }
    `).join('');
    style.textContent = `
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: 210mm; height: 297mm; margin: 0; }
      body {
        color: #17352e;
        background: #fff;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sheet {
        width: 210mm;
        height: 297mm;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
        gap: 5mm;
        padding: 10mm;
        break-after: page;
        page-break-after: always;
      }
      .sheet:last-child { break-after: auto; page-break-after: auto; }
      .label-row {
        display: flex;
        flex: 0 0 auto;
        align-items: flex-start;
        justify-content: center;
        gap: 5mm;
      }
      .label {
        position: relative;
        width: var(--label-width);
        height: var(--label-height);
        flex: 0 0 var(--label-width);
        overflow: hidden;
        padding: var(--label-padding);
        background: #fff;
      }
      .label::before {
        position: absolute;
        inset: var(--border-inset);
        border: 0.35mm solid #176b55;
        border-radius: var(--border-radius);
        content: '';
        pointer-events: none;
      }
      .label-content {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: var(--qr-size) var(--divider-width) minmax(0, 1fr);
        align-items: center;
        gap: var(--content-gap);
        min-width: 0;
      }
      .qr-shell {
        width: var(--qr-size);
        height: var(--qr-size);
        padding: var(--qr-padding);
        border: 0.3mm solid #d7e6df;
        border-radius: var(--qr-radius);
        background: #fff;
      }
      .qr-shell svg { display: block; width: 100%; height: 100%; }
      .divider {
        width: var(--divider-width);
        height: 88%;
        background: linear-gradient(180deg, transparent, #dcebe5 12%, #176b55 50%, #dcebe5 88%, transparent);
      }
      .details {
        height: 100%;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .brand {
        width: 100%;
        height: var(--brand-height);
        flex: 0 0 var(--brand-height);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .brand img {
        display: block;
        width: var(--logo-width);
        max-height: var(--logo-height);
        object-fit: contain;
        object-position: center;
      }
      .brand span {
        color: #176b55;
        font-size: var(--caption-font);
        font-weight: 700;
        letter-spacing: 0.11em;
        line-height: 1;
        text-align: center;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .identity {
        width: 100%;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        justify-content: center;
        gap: var(--identity-gap);
        min-height: 0;
        text-align: center;
      }
      .code {
        display: block;
        width: 100%;
        padding: var(--code-padding-y) var(--code-padding-x);
        overflow: hidden;
        border-radius: 999px;
        color: #fff;
        background: #176b55;
        font-size: var(--code-font);
        font-weight: 700;
        letter-spacing: 0.05em;
        line-height: 1;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .name {
        display: block;
        width: 100%;
        overflow: hidden;
        color: #183b32;
        font-size: var(--name-font);
        font-weight: 700;
        line-height: 1.1;
        text-align: center;
        text-overflow: ellipsis;
        text-transform: uppercase;
        white-space: nowrap;
      }
      ${sizeRules}
    `;
    document.head.append(style);

    const logos: HTMLImageElement[] = [];
    const fittedCodes: Array<{ element: HTMLDivElement; maximum: number; minimum: number }> = [];
    const fittedNames: Array<{ element: HTMLDivElement; maximum: number; minimum: number }> = [];
    const printMetricBySize = new Map(printMetrics.map(metric => [metric.option.id, metric]));

    labelPages.forEach(page => {
      const sheet = document.createElement('main');
      sheet.className = 'sheet';

      page.rows.forEach(row => {
        const labelRow = document.createElement('div');
        labelRow.className = 'label-row';

        row.entries.forEach(({ item, size }) => {
          const metric = printMetricBySize.get(size.id);
          const qrSvgMarkup = qrSvgMarkupByItemId[item.id];
          if (!metric || !qrSvgMarkup) return;

          const {
            option,
            codeMaximumFontPt,
            codeMinimumFontPt,
            nameMaximumFontPt,
            nameMinimumFontPt
          } = metric;
          const label = document.createElement('article');
          label.className = 'label';
          label.dataset.size = option.id;

          const content = document.createElement('div');
          content.className = 'label-content';
          const qrTemplate = document.createElement('template');
          qrTemplate.innerHTML = qrSvgMarkup;
          const qrCode = qrTemplate.content.querySelector('svg');
          const qrShell = document.createElement('div');
          qrShell.className = 'qr-shell';
          if (qrCode) qrShell.append(qrCode);
          content.append(qrShell);

          const divider = document.createElement('div');
          divider.className = 'divider';
          content.append(divider);

          const details = document.createElement('div');
          details.className = 'details';
          const brand = document.createElement('header');
          brand.className = 'brand';
          const logo = document.createElement('img');
          logo.src = new URL(brandLogoUrl, window.location.href).href;
          logo.alt = 'Filtrovali';
          logos.push(logo);
          const brandCaption = document.createElement('span');
          brandCaption.textContent = 'Identificação de equipamento';
          brand.append(logo, brandCaption);
          details.append(brand);

          const identity = document.createElement('section');
          identity.className = 'identity';
          if (item.code) {
            const code = document.createElement('div');
            code.className = 'code';
            code.textContent = item.code;
            fittedCodes.push({ element: code, maximum: codeMaximumFontPt, minimum: codeMinimumFontPt });
            identity.append(code);
          }

          const name = document.createElement('div');
          name.className = 'name';
          name.textContent = item.name.toLocaleUpperCase('pt-BR');
          fittedNames.push({ element: name, maximum: nameMaximumFontPt, minimum: nameMinimumFontPt });
          identity.append(name);
          details.append(identity);
          content.append(details);
          label.append(content);
          labelRow.append(label);
        });

        sheet.append(labelRow);
      });

      document.body.append(sheet);
    });

    let printStarted = false;
    const startPrint = () => {
      if (printStarted) return;
      printStarted = true;
      const fitText = ({ element, maximum, minimum }: { element: HTMLDivElement; maximum: number; minimum: number }) => {
        let currentFontSize = maximum;
        while (element.scrollWidth > element.clientWidth && currentFontSize > minimum) {
          currentFontSize = Math.max(minimum, currentFontSize - 0.25);
          element.style.fontSize = `${currentFontSize.toFixed(2)}pt`;
        }
      };
      fittedCodes.forEach(fitText);
      fittedNames.forEach(fitText);
      printWindow.focus();
      printWindow.print();
    };

    const pendingLogos = logos.filter(logo => !logo.complete);
    if (pendingLogos.length === 0) {
      window.setTimeout(startPrint, 100);
    } else {
      let pendingCount = pendingLogos.length;
      const handleLogoReady = () => {
        pendingCount -= 1;
        if (pendingCount === 0) startPrint();
      };
      pendingLogos.forEach(logo => {
        logo.addEventListener('load', handleLogoReady, { once: true });
        logo.addEventListener('error', handleLogoReady, { once: true });
      });
      window.setTimeout(startPrint, 1200);
    }
  }

  return (
    <Modal
      open={items.length > 0}
      onClose={onClose}
      ariaLabelledBy="romaneio-qr-label-title"
      ariaDescribedBy="romaneio-qr-label-description"
      panelClassName="modal-card romaneio-qr-label-modal"
    >
      <div className="section-title" id="romaneio-qr-label-title">
        {isBatch ? `QR codes da categoria ${categoryName}` : 'QR code do equipamento'}
      </div>
      <p className="placeholder-copy" id="romaneio-qr-label-description">
        {isBatch
          ? `${items.length} equipamentos serão organizados automaticamente em folhas A4. Na impressão, escolha uma impressora ou Salvar como PDF.`
          : 'Imprima a etiqueta e cole-a no equipamento correspondente.'}
      </p>
      <fieldset className="romaneio-qr-label-size-fieldset">
        <legend>Tamanhos para imprimir</legend>
        <p>Selecione um ou mais tamanhos para compor a mesma folha A4.</p>
        <div className="romaneio-qr-label-size-options">
          {labelSizeOptions.map(option => {
            const isSelected = selectedLabelSizes.includes(option.id);
            return (
              <button
                className={isSelected ? 'is-selected' : ''}
                type="button"
                key={option.id}
                aria-pressed={isSelected}
                title={isSelected && selectedLabelSizes.length === 1 ? 'Mantenha ao menos um tamanho selecionado.' : undefined}
                onClick={() => toggleLabelSize(option.id)}
              >
                <span className="romaneio-qr-label-size-check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                <strong>{option.label}</strong>
                <span>{option.widthMillimeters} × {option.heightMillimeters} mm</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {items.length > 0 ? (
        <div className="romaneio-qr-sheet-preview-section">
          <div className="romaneio-qr-sheet-preview-heading">
            <strong>{labelPages.length > 1 ? 'Prévia da primeira folha A4' : 'Prévia da folha A4'}</strong>
            <span>
              {totalLabels} {totalLabels === 1 ? 'etiqueta' : 'etiquetas'} · {labelPages.length} {labelPages.length === 1 ? 'página' : 'páginas'}
            </span>
          </div>
          <div
            className="romaneio-qr-sheet-preview"
            aria-live="polite"
            aria-label={`Pré-visualização da primeira folha A4 de um total de ${labelPages.length} ${labelPages.length === 1 ? 'página' : 'páginas'}`}
          >
            {isGenerating ? <span className="rel-meta">Gerando QR code...</span> : null}
            {isReady && firstPreviewPage ? (
              <div className="romaneio-qr-sheet-preview-rows">
                {firstPreviewPage.rows.map((row, rowIndex) => (
                  <div className="romaneio-qr-sheet-preview-row" key={rowIndex}>
                    {row.entries.map(({ item, size }) => (
                      <article
                        className="romaneio-qr-label"
                        data-label-size={size.id}
                        key={`${item.id}-${size.id}`}
                        aria-label={`Etiqueta de ${item.name}, tamanho ${size.label}, ${size.widthMillimeters} por ${size.heightMillimeters} milímetros`}
                      >
                        <div className="romaneio-qr-label-content">
                          <div className="romaneio-qr-code-shell">
                            <div
                              className="romaneio-qr-code"
                              dangerouslySetInnerHTML={{ __html: qrSvgMarkupByItemId[item.id] }}
                            />
                          </div>
                          <div className="romaneio-qr-label-divider" />
                          <div className="romaneio-qr-label-details">
                            <div className="romaneio-qr-label-brand">
                              <img src={brandLogoUrl} alt="Filtrovali" />
                              <span>Identificação de equipamento</span>
                            </div>
                            <div className="romaneio-qr-label-identity">
                              {item.code ? <RomaneioQrLabelPreviewCode code={item.code} /> : null}
                              <RomaneioQrLabelPreviewName
                                name={item.name}
                                labelWidthMillimeters={size.widthMillimeters}
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="admin-form-actions">
        <button className="secondary-button" type="button" onClick={onClose}>Fechar</button>
        <button
          className="primary-button"
          type="button"
          onClick={printLabel}
          disabled={Boolean(error) || isGenerating || !isReady}
        >
          {`Baixar / imprimir ${totalLabels} ${totalLabels === 1 ? 'etiqueta' : 'etiquetas'}`}
        </button>
      </div>
    </Modal>
  );
}
