# Contract: Acompanhamento Mission Groups API

Base path: `/api/acompanhamento/comercial`

Authentication: all endpoints require `requireAuth`.

Authorization:

- Read/list and grouped dashboard/cards: `requireAcompanhamentoAccess`.
- Create/rename/dissolve groups: `requireAcompanhamentoManager`.

All request bodies and query params are validated with Zod before business logic.

## Existing Endpoint Change: GET `/dashboard`

Returns Dashboard items with active mission groups applied.

### Response

```ts
type DashboardItem = DashboardProjectRow | DashboardGroupRow;

interface DashboardProjectRow {
  kind?: 'PROJECT';
  projectId: string;
  code: string;
  name: string;
  clientName: string;
  // existing DashboardRow fields remain unchanged
}

interface DashboardGroupRow {
  kind: 'GROUP';
  groupId: string;
  code: string;
  name: string;
  clientName: string;
  members: Array<{
    projectId: string;
    code: string;
    name: string;
    clientName: string;
  }>;
  salePrice: number | null;
  invoicedRevenue: number | null;
  invoiceCount: number;
  plannedTotalCost: number | null;
  expectedProfit: number | null;
  expectedMargin: number | null;
  components: Record<string, number | null>;
  rdoCount: number;
  realizedOmieCost: number | null;
  realizedCost: number | null;
  realizedPaid: number | null;
  stockCost: number | null;
  presumedProfitTaxes: PresumedProfitTaxEstimate | null;
  progressPct: number | null;
  progressMethod: 'GROUP_WEIGHTED' | 'GROUP_AVERAGE' | null;
  archived: boolean;
}
```

### Behavior

- Individual rows whose `projectId` belongs to an active group are omitted.
- One `DashboardGroupRow` is inserted per active group with at least one member present in the current dashboard result.
- Existing `category` query filtering is applied before grouping, so totals reflect the same filtered data set the user requested.

## Existing Endpoint Change: GET `/projetos-cards`

Returns project card items with active mission groups applied.

### Response

```ts
type ProjectCardItem = ProjectCard | MissionGroupCard;

interface ProjectCard {
  kind?: 'PROJECT';
  projectId: string;
  code: string;
  name: string;
  clientName: string;
  // existing ProjectCard fields remain unchanged
}

interface MissionGroupCard {
  kind: 'GROUP';
  groupId: string;
  code: string;
  name: string;
  clientName: string;
  members: Array<{
    projectId: string;
    code: string;
    name: string;
    clientName: string;
    category: 'ANDAMENTO' | 'FUTURO' | 'ARQUIVADO';
    progressPct: number | null;
  }>;
  archived: boolean;
  category: 'ANDAMENTO' | 'FUTURO' | 'ARQUIVADO';
  workedDays: number;
  totalDays: number | null;
  daysConsumedPct: number | null;
  workedHours: WorkedHoursProgress;
  progressPct: number | null;
  progressMethod: 'GROUP_WEIGHTED' | 'GROUP_AVERAGE' | null;
  plannedCost: number | null;
  invoicedRevenue: number | null;
  invoiceCount: number;
  presumedProfitTaxes: PresumedProfitTaxEstimate | null;
  realizedCost: number;
  costConsumedPct: number | null;
  lastDay: { date: string | null; status: LastDayStatus };
  collaboratorsCount: number;
  startDate: string | null;
  expectedEndDate: string | null;
  laborCost: number | null;
  laborCostBase: number | null;
  stockCost: number;
  equipment: Array<{ name: string; days: number; since: string }>;
  alerts: ProjectAlert[];
}
```

### Behavior

- Individual cards whose `projectId` belongs to an active group are omitted.
- A group card does not open the project detail directly. The UI exposes member missions inside the card so the user can open an individual detail.

## GET `/grupos-missoes`

Lists mission groups.

### Query

```ts
interface MissionGroupListQuery {
  status?: 'ACTIVE' | 'DISSOLVED' | 'ALL'; // default ACTIVE
}
```

### Response

```ts
interface MissionGroupResponse {
  id: string;
  name: string;
  status: 'ACTIVE' | 'DISSOLVED';
  createdAt: string;
  updatedAt: string;
  dissolvedAt: string | null;
  members: Array<{
    projectId: string;
    code: string;
    name: string;
    clientName: string;
    order: number;
  }>;
}
```

### Errors

- `403` if user cannot access Acompanhamento.

## POST `/grupos-missoes`

Creates an active group.

### Request

```ts
interface CreateMissionGroupRequest {
  name?: string; // trimmed, 1..120 when provided
  projectIds: string[]; // 2..50, distinct
}
```

### Response

`201 Created`

```ts
MissionGroupResponse
```

### Validation

- At least 2 distinct project IDs.
- All projects exist and are not deleted.
- No project is already in another active group.
- If `name` is absent, backend generates a display name from common client/code data.
- If project clients differ, backend still accepts but returns a warning field for UI display.

### Errors

- `400` invalid request body or business validation failure.
- `403` user is not Acompanhamento manager.

## PATCH `/grupos-missoes/:groupId`

Renames an active group.

### Request

```ts
interface RenameMissionGroupRequest {
  name: string; // trimmed, 1..120
}
```

### Response

```ts
MissionGroupResponse
```

### Errors

- `400` invalid name or group already dissolved.
- `403` user is not Acompanhamento manager.
- `404` group not found.

## POST `/grupos-missoes/:groupId/desmesclar`

Dissolves an active group.

### Request

No body.

### Response

```ts
{
  ok: true;
  groupId: string;
  dissolvedAt: string;
}
```

### Behavior

- Sets group status to `DISSOLVED`.
- Sets every member `activeProjectId` to `null`.
- Keeps membership history for audit.
- After the next dashboard/cards fetch, individual mission rows/cards are visible again.

### Errors

- `400` group already dissolved.
- `403` user is not Acompanhamento manager.
- `404` group not found.
