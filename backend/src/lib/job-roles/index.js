const jobRoleNameCollator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

export function sortJobRolesByName(items) {
  return [...items].sort((a, b) => {
    const nameComparison = jobRoleNameCollator.compare(a.name || '', b.name || '');
    if (nameComparison !== 0) return nameComparison;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}
