import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { RomaneioCatalogItem } from '../../api/romaneio';
import { Modal } from '../../components/ui/Modal';
import { buildRomaneioItemQrValue } from '../../utils/romaneioQr';

const assetsBaseUrl = (import.meta.env.VITE_ASSETS_BASE_URL || '').replace(/\/$/, '');
const brandLogoUrl = `${assetsBaseUrl}/assets/Logo/LOGO_COLORIDO.png`;

const labelSizeOptions = [
  { id: 'large', label: 'Grande', millimeters: 120 },
  { id: 'medium', label: 'Média', millimeters: 80 },
  { id: 'small', label: 'Pequena', millimeters: 60 }
] as const;

type RomaneioQrLabelSize = typeof labelSizeOptions[number]['id'];

const previewNameMaximumFontCqw = 18 * 25.4 / 72 / 120 * 100;
const previewCodeMaximumFontCqw = 30 * 25.4 / 72 / 120 * 100;
const previewCodeMinimumFontCqw = 16 * 25.4 / 72 / 120 * 100;

function previewNameMinimumFontCqw(labelMillimeters: number) {
  const scale = labelMillimeters / labelSizeOptions[0].millimeters;
  const minimumFontPt = Math.max(10 * scale, 6.5);
  return minimumFontPt * 25.4 / 72 / labelMillimeters * 100;
}

function RomaneioQrLabelPreviewName({ name, labelMillimeters }: { name: string; labelMillimeters: number }) {
  const elementRef = useRef<HTMLElement>(null);
  const uppercaseName = name.toLocaleUpperCase('pt-BR');

  useLayoutEffect(() => {
    const element = elementRef.current;
    const label = element?.closest<HTMLElement>('.romaneio-qr-label');
    if (!element || !label) return;

    const fitName = () => {
      element.style.fontSize = `${previewNameMaximumFontCqw}cqw`;
      let currentFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
      const minimumFontSize = label.clientWidth * previewNameMinimumFontCqw(labelMillimeters) / 100;
      while (element.scrollWidth > element.clientWidth && currentFontSize > minimumFontSize) {
        currentFontSize = Math.max(minimumFontSize, currentFontSize - 0.25);
        element.style.fontSize = `${currentFontSize.toFixed(2)}px`;
      }
    };

    fitName();
    const resizeObserver = new ResizeObserver(fitName);
    resizeObserver.observe(label);
    return () => resizeObserver.disconnect();
  }, [labelMillimeters, uppercaseName]);

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
  item: RomaneioCatalogItem | null;
  onClose: () => void;
}

export function RomaneioQrLabelModal({ item, onClose }: RomaneioQrLabelModalProps) {
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrSvgMarkup, setQrSvgMarkup] = useState('');
  const [selectedLabelSizes, setSelectedLabelSizes] = useState<RomaneioQrLabelSize[]>(['large']);

  useEffect(() => {
    if (!item) return;

    let disposed = false;
    setQrSvgMarkup('');
    setIsGenerating(true);
    void import('@zxing/browser').then(({ BrowserQRCodeSvgWriter }) => {
      if (disposed) return;
      const value = buildRomaneioItemQrValue(item.id);
      const qrCode = new BrowserQRCodeSvgWriter().write(value, 320, 320);
      qrCode.setAttribute('role', 'img');
      qrCode.setAttribute('aria-label', `QR code de ${item.name}`);
      setQrSvgMarkup(qrCode.outerHTML);
      setError('');
      setIsGenerating(false);
    }).catch(() => {
      if (disposed) return;
      setQrSvgMarkup('');
      setError('Não foi possível gerar o QR code deste item.');
      setIsGenerating(false);
    });

    return () => {
      disposed = true;
    };
  }, [item]);

  const selectedSizeOptions = labelSizeOptions.filter(option => selectedLabelSizes.includes(option.id));

  function toggleLabelSize(size: RomaneioQrLabelSize) {
    setSelectedLabelSizes(current => {
      const isSelected = current.includes(size);
      if (isSelected && current.length === 1) return current;
      const next = isSelected ? current.filter(value => value !== size) : [...current, size];
      return labelSizeOptions.filter(option => next.includes(option.id)).map(option => option.id);
    });
  }

  function printLabel() {
    if (!item || !qrSvgMarkup || selectedSizeOptions.length === 0) return;

    const printMetrics = selectedSizeOptions.map(option => {
      const scale = option.millimeters / labelSizeOptions[0].millimeters;
      const scaledMm = (value: number, minimum = 0) => Math.max(value * scale, minimum).toFixed(2);
      return {
        option,
        scale,
        scaledMm,
        codeMaximumFontPt: Math.max(30 * scale, 15),
        codeMinimumFontPt: Math.max(16 * scale, 8),
        nameMaximumFontPt: Math.max(18 * scale, 9),
        nameMinimumFontPt: Math.max(10 * scale, 6.5)
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
        --label-size: ${option.millimeters}mm;
        --label-padding: ${scaledMm(4.8)}mm;
        --border-inset: ${scaledMm(2.25, 1.1)}mm;
        --border-radius: ${scaledMm(3.2, 1.8)}mm;
        --brand-height: ${scaledMm(11.2)}mm;
        --brand-gap: ${scaledMm(3)}mm;
        --brand-padding: ${scaledMm(1.2)}mm;
        --logo-width: ${scaledMm(42)}mm;
        --logo-height: ${scaledMm(10.2)}mm;
        --caption-font: ${Math.max(7.2 * scale, 4.7).toFixed(1)}pt;
        --divider-top: ${scaledMm(1.5)}mm;
        --divider-side: ${scaledMm(1.2)}mm;
        --qr-size: ${scaledMm(64.5)}mm;
        --qr-margin-top: ${scaledMm(2.25)}mm;
        --qr-margin-bottom: ${scaledMm(1.35)}mm;
        --qr-padding: ${scaledMm(2.25)}mm;
        --qr-radius: ${scaledMm(3, 1.5)}mm;
        --identity-padding-side: ${scaledMm(1.4)}mm;
        --identity-padding-bottom: ${scaledMm(1.5)}mm;
        --code-margin-bottom: ${scaledMm(1.2)}mm;
        --code-padding-y: ${scaledMm(1)}mm;
        --code-padding-x: ${scaledMm(4.2)}mm;
        --code-font: ${codeMaximumFontPt.toFixed(1)}pt;
        --name-max-width: ${scaledMm(110)}mm;
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
        align-items: center;
        justify-content: center;
        gap: 5mm;
      }
      .label {
        position: relative;
        width: var(--label-size);
        height: var(--label-size);
        flex: 0 0 var(--label-size);
        overflow: hidden;
        display: flex;
        flex-direction: column;
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
      .brand {
        z-index: 1;
        height: var(--brand-height);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--brand-gap);
        padding: 0 var(--brand-padding);
      }
      .brand img {
        display: block;
        width: var(--logo-width);
        max-height: var(--logo-height);
        object-fit: contain;
        object-position: left center;
      }
      .brand span {
        color: #176b55;
        font-size: var(--caption-font);
        font-weight: 700;
        letter-spacing: 0.11em;
        line-height: 1.15;
        text-align: right;
        text-transform: uppercase;
      }
      .divider {
        z-index: 1;
        height: 0.3mm;
        margin: var(--divider-top) var(--divider-side) 0;
        background: linear-gradient(90deg, #176b55, #dcebe5 72%, transparent);
      }
      .qr-shell {
        z-index: 1;
        width: var(--qr-size);
        height: var(--qr-size);
        flex: 0 0 var(--qr-size);
        margin: var(--qr-margin-top) auto var(--qr-margin-bottom);
        padding: var(--qr-padding);
        border: 0.3mm solid #d7e6df;
        border-radius: var(--qr-radius);
        background: #fff;
      }
      .qr-shell svg { display: block; width: 100%; height: 100%; }
      .identity {
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        justify-content: center;
        min-height: 0;
        padding: 0 var(--identity-padding-side) var(--identity-padding-bottom);
        text-align: center;
      }
      .code {
        display: inline-block;
        width: var(--qr-size);
        max-width: 100%;
        margin-bottom: var(--code-margin-bottom);
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
        max-width: var(--name-max-width);
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

    const sheet = document.createElement('main');
    sheet.className = 'sheet';
    const logos: HTMLImageElement[] = [];
    const fittedCodes: Array<{ element: HTMLDivElement; maximum: number; minimum: number }> = [];
    const fittedNames: Array<{ element: HTMLDivElement; maximum: number; minimum: number }> = [];

    printMetrics.forEach(({
      option,
      codeMaximumFontPt,
      codeMinimumFontPt,
      nameMaximumFontPt,
      nameMinimumFontPt
    }) => {
      const label = document.createElement('article');
      label.className = 'label';
      label.dataset.size = option.id;

      const brand = document.createElement('header');
      brand.className = 'brand';
      const logo = document.createElement('img');
      logo.src = new URL(brandLogoUrl, window.location.href).href;
      logo.alt = 'Filtrovali';
      logos.push(logo);
      const brandCaption = document.createElement('span');
      brandCaption.textContent = 'Identificação de equipamento';
      brand.append(logo, brandCaption);
      label.append(brand);

      const divider = document.createElement('div');
      divider.className = 'divider';
      label.append(divider);

      const qrTemplate = document.createElement('template');
      qrTemplate.innerHTML = qrSvgMarkup;
      const qrCode = qrTemplate.content.querySelector('svg');
      const qrShell = document.createElement('div');
      qrShell.className = 'qr-shell';
      if (qrCode) qrShell.append(qrCode);
      label.append(qrShell);

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
      label.append(identity);
      sheet.append(label);
    });

    document.body.append(sheet);

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
      open={Boolean(item)}
      onClose={onClose}
      ariaLabelledBy="romaneio-qr-label-title"
      ariaDescribedBy="romaneio-qr-label-description"
      panelClassName="modal-card romaneio-qr-label-modal"
    >
      <div className="section-title" id="romaneio-qr-label-title">QR code do equipamento</div>
      <p className="placeholder-copy" id="romaneio-qr-label-description">
        Imprima a etiqueta e cole-a no equipamento correspondente.
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
                <span>{option.millimeters} × {option.millimeters} mm</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {item ? (
        <div className="romaneio-qr-sheet-preview-section">
          <div className="romaneio-qr-sheet-preview-heading">
            <strong>Prévia da folha A4</strong>
            <span>{selectedSizeOptions.length} {selectedSizeOptions.length === 1 ? 'etiqueta' : 'etiquetas'}</span>
          </div>
          <div
            className="romaneio-qr-sheet-preview"
            aria-live="polite"
            aria-label={`Pré-visualização da folha A4 com ${selectedSizeOptions.length} ${selectedSizeOptions.length === 1 ? 'etiqueta' : 'etiquetas'}`}
          >
            {isGenerating ? <span className="rel-meta">Gerando QR code...</span> : null}
            {qrSvgMarkup ? selectedSizeOptions.map(option => (
              <article
                className="romaneio-qr-label"
                data-label-size={option.id}
                key={option.id}
                aria-label={`Etiqueta ${option.label}, ${option.millimeters} por ${option.millimeters} milímetros`}
              >
                <div className="romaneio-qr-label-content">
                  <div className="romaneio-qr-label-brand">
                    <img src={brandLogoUrl} alt="Filtrovali" />
                    <span>Identificação de equipamento</span>
                  </div>
                  <div className="romaneio-qr-label-divider" />
                  <div className="romaneio-qr-code-shell">
                    <div
                      className="romaneio-qr-code"
                      dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
                    />
                  </div>
                  <div className="romaneio-qr-label-identity">
                    {item.code ? <RomaneioQrLabelPreviewCode code={item.code} /> : null}
                    <RomaneioQrLabelPreviewName
                      name={item.name}
                      labelMillimeters={option.millimeters}
                    />
                  </div>
                </div>
              </article>
            )) : null}
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
          disabled={Boolean(error) || isGenerating || !qrSvgMarkup}
        >
          {selectedSizeOptions.length === 1 ? 'Imprimir etiqueta' : `Imprimir ${selectedSizeOptions.length} etiquetas`}
        </button>
      </div>
    </Modal>
  );
}
