export function clientCnpjKey(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || null;
}

function nameKey(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function sameClientKey(item = {}) {
  return clientCnpjKey(item.clientCnpj) ?? (nameKey(item.clientName) ? `name:${nameKey(item.clientName)}` : null);
}

export function sameClientName(items = []) {
  const withIdentity = items
    .map(item => ({
      key: sameClientKey(item),
      name: nameKey(item.clientName)
    }))
    .filter(item => item.key);
  const keys = Array.from(new Set(withIdentity.map(item => item.key)));
  if (keys.length === 0) return '';
  if (keys.length > 1) return 'Clientes distintos';
  return withIdentity.find(item => item.name)?.name ?? '';
}

export function hasSameClient(items = []) {
  const keys = Array.from(new Set(items.map(sameClientKey).filter(Boolean)));
  return keys.length <= 1;
}
