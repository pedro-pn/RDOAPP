import prisma from '../src/lib/prisma.js';

function normalizedRole(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

export function planJobRoleBackfill(collaborators, jobRoles) {
  const byName = new Map();
  for (const role of jobRoles) {
    const key = normalizedRole(role.name);
    if (!key) continue;
    const current = byName.get(key) || [];
    current.push(role);
    byName.set(key, current);
  }

  const matches = [];
  const unresolved = [];
  for (const collaborator of collaborators) {
    if (collaborator.jobRoleId) continue;
    const roles = byName.get(normalizedRole(collaborator.role)) || [];
    if (roles.length === 1) {
      matches.push({ collaboratorId: collaborator.id, jobRoleId: roles[0].id });
    } else {
      unresolved.push({ collaboratorId: collaborator.id, role: collaborator.role, candidates: roles.length });
    }
  }
  return { matches, unresolved };
}

export async function runJobRoleBackfill({ database = prisma, apply = false } = {}) {
  const [collaborators, jobRoles] = await Promise.all([
    database.collaborator.findMany({
      where: { jobRoleId: null },
      select: { id: true, role: true, jobRoleId: true }
    }),
    database.jobRole.findMany({ select: { id: true, name: true } })
  ]);
  const plan = planJobRoleBackfill(collaborators, jobRoles);
  if (apply && plan.matches.length) {
    await database.$transaction(plan.matches.map(match => database.collaborator.update({
      where: { id: match.collaboratorId },
      data: { jobRoleId: match.jobRoleId }
    })));
  }
  return { mode: apply ? 'apply' : 'dry-run', ...plan };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const apply = process.argv.includes('--apply');
  runJobRoleBackfill({ apply })
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .finally(() => prisma.$disconnect());
}
