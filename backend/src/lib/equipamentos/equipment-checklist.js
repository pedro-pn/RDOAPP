const MAX_CHECKLIST_ITEMS = 100;
const MAX_CHECKLIST_ITEM_LENGTH = 300;
const CHECKLIST_DISPLAY_MODES = new Set(['AUTO', 'TAG', 'NAME']);
export const CHECKLIST_ITEM_STATUSES = ['CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL'];
const CHECKLIST_ITEM_STATUS_SET = new Set(CHECKLIST_ITEM_STATUSES);

export function normalizeChecklistItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item ?? '').trim().slice(0, MAX_CHECKLIST_ITEM_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_CHECKLIST_ITEMS);
}

export function resolveEffectiveChecklist(equipment, category) {
  if (!category?.checklistEnabled) return [];
  const source = equipment?.checklistItems ?? category?.checklistItems;
  return normalizeChecklistItems(source);
}

export function normalizeChecklistDisplayMode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return CHECKLIST_DISPLAY_MODES.has(normalized) ? normalized : 'AUTO';
}

export function normalizeChecklistItemStatus(value, fallback = 'CONFORME') {
  const normalized = String(value || '').trim().toUpperCase();
  if (CHECKLIST_ITEM_STATUS_SET.has(normalized)) return normalized;
  return CHECKLIST_ITEM_STATUS_SET.has(fallback) ? fallback : 'CONFORME';
}

export function checklistItemStatusFromSnapshot(item, fallback = 'CONFORME') {
  if (item?.status) return normalizeChecklistItemStatus(item.status, fallback);
  if (typeof item?.checked === 'boolean') return item.checked ? 'CONFORME' : 'NAO_CONFORME';
  return normalizeChecklistItemStatus(fallback);
}

export function resolveChecklistCategoryName({ catalogItem, equipment, category, romaneioItem } = {}) {
  return String(
    category?.name ||
    equipment?.category?.name ||
    catalogItem?.categoryName ||
    romaneioItem?.categoryName ||
    ''
  ).trim();
}

function itemCode({ catalogItem, equipment, romaneioItem } = {}) {
  return String(equipment?.code || catalogItem?.code || romaneioItem?.itemCode || '').trim();
}

function itemName({ catalogItem, equipment, romaneioItem } = {}) {
  return String(equipment?.name || catalogItem?.name || romaneioItem?.itemName || '').trim();
}

function shouldAutoUseName({ catalogItem } = {}) {
  if (!catalogItem) return false;
  if (catalogItem.sourceType === 'STOCK') return true;
  if (catalogItem.isSerialized === false) return true;
  return catalogItem.measureType && catalogItem.measureType !== 'UNIT';
}

export function resolveChecklistDisplayName({ catalogItem, equipment, romaneioItem, displayMode } = {}) {
  const mode = normalizeChecklistDisplayMode(displayMode);
  const code = itemCode({ catalogItem, equipment, romaneioItem });
  const name = itemName({ catalogItem, equipment, romaneioItem });

  if (mode === 'TAG') return code || name;
  if (mode === 'NAME') return name || code;
  return shouldAutoUseName({ catalogItem }) ? (name || code) : (code || name);
}
