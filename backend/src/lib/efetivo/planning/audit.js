function sanitizeSnapshot(value) {
  if (value == null) return null;
  const blocked = /password|token|secret|cookie|authorization/i;
  const visit = input => {
    if (Array.isArray(input)) return input.map(visit);
    if (input instanceof Date) return input.toISOString();
    if (!input || typeof input !== 'object') return input;
    return Object.fromEntries(Object.entries(input)
      .filter(([key]) => !blocked.test(key))
      .map(([key, child]) => [key, visit(child)]));
  };
  return visit(value);
}

export async function recordEfetivoAudit(tx, {
  planId = null,
  actorUserId = null,
  action,
  entityType,
  entityId,
  summary,
  beforeData = null,
  afterData = null,
  evidence = {}
}) {
  return tx.efetivoAuditEvent.create({
    data: {
      planId,
      actorUserId,
      action,
      entityType,
      entityId,
      summary,
      beforeData: sanitizeSnapshot(beforeData),
      afterData: sanitizeSnapshot(afterData),
      ipAddress: evidence.ipAddress || null,
      userAgent: evidence.userAgent || null
    }
  });
}

export { sanitizeSnapshot };
