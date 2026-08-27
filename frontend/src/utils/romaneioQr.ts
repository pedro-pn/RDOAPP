import type { RomaneioCatalogItem } from '../api/romaneio';
import { romaneioUsesVariableQuantity } from './romaneioMeasure';

const ROMANEIO_QR_PREFIX = 'FILTROVALI:ROMANEIO_ITEM:1:';
const CATALOG_ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function buildRomaneioItemQrValue(catalogItemId: string) {
  const normalizedId = catalogItemId.trim();
  if (!CATALOG_ITEM_ID_PATTERN.test(normalizedId)) {
    throw new Error('Identificador de item inválido para QR code.');
  }
  return `${ROMANEIO_QR_PREFIX}${normalizedId}`;
}

export function parseRomaneioItemQrValue(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue.startsWith(ROMANEIO_QR_PREFIX)) return null;
  const catalogItemId = normalizedValue.slice(ROMANEIO_QR_PREFIX.length);
  return CATALOG_ITEM_ID_PATTERN.test(catalogItemId) ? catalogItemId : null;
}

export function romaneioQrRequiresQuantity(
  item: Pick<RomaneioCatalogItem, 'isSerialized' | 'measureType'>
) {
  return !item.isSerialized || romaneioUsesVariableQuantity(item.measureType);
}
