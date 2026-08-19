export function effectiveEpiRole(collaborator) {
  const override = String(collaborator?.epiRoleOverride || '').trim();
  return override || String(collaborator?.role || '').trim();
}
