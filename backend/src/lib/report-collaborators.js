function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nightCollaboratorSnapshot(value) {
  if (typeof value === 'string') return { name: value.trim(), role: '' };
  const record = asRecord(value);
  return {
    id: stringValue(record.id),
    name: stringValue(record.name),
    role: stringValue(record.role)
  };
}

export function reportCollaboratorCreateData(collaborator) {
  const jobRole = collaborator?.jobRole;
  return {
    collaboratorId: collaborator.id,
    jobRoleIdSnapshot: jobRole?.id || collaborator?.jobRoleId || null,
    roleNameSnapshot: stringValue(jobRole?.name)
  };
}

export async function reportCollaboratorCreateManyData(database, collaboratorIds = []) {
  const uniqueIds = [...new Set(collaboratorIds.filter(Boolean))];
  if (!uniqueIds.length) return [];
  const collaborators = await database.collaborator.findMany({
    where: { id: { in: uniqueIds } },
    include: { jobRole: true }
  });
  const byId = new Map(collaborators.map(collaborator => [collaborator.id, collaborator]));
  const missingIds = uniqueIds.filter(id => !byId.has(id));
  if (missingIds.length) {
    const error = new Error('Um ou mais colaboradores do relatório não foram encontrados.');
    error.status = 400;
    error.statusCode = 400;
    error.missingCollaboratorIds = missingIds;
    throw error;
  }
  return uniqueIds.map(id => reportCollaboratorCreateData(byId.get(id)));
}

export function buildReportCollaboratorRows(report) {
  const rows = new Map();
  const keyByName = new Map();

  function rowKey(entry) {
    if (entry.id) return `id:${entry.id}`;
    const existingNameKey = keyByName.get(entry.name);
    if (existingNameKey) return existingNameKey;
    return `name:${entry.name}`;
  }

  function upsert(entry, shift) {
    const name = stringValue(entry.name);
    if (!name) return;
    const normalized = {
      id: stringValue(entry.id),
      name,
      role: stringValue(entry.role)
    };
    const key = rowKey(normalized);
    const existing = rows.get(key);
    if (existing) {
      if (!existing.collaboratorposition && normalized.role) existing.collaboratorposition = normalized.role;
      existing.shifts.add(shift);
      return;
    }
    rows.set(key, {
      collaboratorname: normalized.name,
      collaboratorname0: normalized.name,
      collaboratorposition: normalized.role,
      shifts: new Set([shift])
    });
    keyByName.set(normalized.name, key);
  }

  const collaboratorById = new Map();
  (report.collaborators || []).forEach(link => {
    const entry = {
      id: link.collaboratorId,
      name: link.collaborator?.name,
      role: link.roleNameSnapshot || link.collaborator?.jobRole?.name
    };
    if (entry.id) collaboratorById.set(entry.id, entry);
    upsert(entry, 'Diurno');
  });

  const nightDetails = asRecord(asRecord(report.specialConditions).noturnoDetails);
  const nightIds = Array.isArray(nightDetails.collaboratorIds)
    ? nightDetails.collaboratorIds.filter(id => typeof id === 'string' && id.trim())
    : [];
  const nightSnapshots = Array.isArray(nightDetails.colaboradores)
    ? nightDetails.colaboradores.map(nightCollaboratorSnapshot)
    : [];
  const usedSnapshotIndexes = new Set();

  nightIds.forEach((id, index) => {
    const linked = collaboratorById.get(id) || {};
    const snapshot = nightSnapshots[index] || {};
    usedSnapshotIndexes.add(index);
    upsert({
      id,
      name: snapshot.name || linked.name || id,
      role: snapshot.role || linked.role
    }, 'Noturno');
  });

  nightSnapshots.forEach((snapshot, index) => {
    if (usedSnapshotIndexes.has(index)) return;
    upsert(snapshot, 'Noturno');
  });

  return Array.from(rows.values()).map(item => ({
    collaboratorname: item.collaboratorname,
    collaboratorname0: item.collaboratorname0,
    collaboratorposition: item.collaboratorposition,
    collaboratorshift: item.shifts.size === 2 ? 'Diurno e Noturno' : Array.from(item.shifts)[0]
  }));
}
