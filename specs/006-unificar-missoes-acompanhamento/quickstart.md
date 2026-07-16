# Quickstart: Unificar Missões no Acompanhamento

## Prerequisites

- Local development environment configured for NewRDO.
- Database available in the local environment.
- User with `acompanhamento:manager` to create/desmesclar groups.
- At least three projects/missões visible in Acompanhamento, with two belonging to the same client.
- `DATABASE_URL` configured for local backend validation commands.

Do not run these validation commands against production or staging.

## Implementation Validation

1. Apply the Prisma migration locally after implementation.

   ```bash
   cd backend
   npm run prisma:migrate
   npm run prisma:generate
   ```

2. Run backend tests.

   ```bash
   cd backend
   npm test
   ```

   Expected:

   - Mission group service rejects fewer than 2 projects.
   - Service rejects project already active in another group.
   - Desmesclar clears active memberships and keeps history.
   - Project card aggregation sums costs/revenue/taxes/hours and hides child cards.
   - Dashboard aggregation hides child rows and recalculates totals/percentages.

3. Build the frontend.

   ```bash
   cd frontend
   npm run build
   ```

   Expected:

   - TypeScript accepts the `PROJECT`/`GROUP` item unions.
   - No broken imports in Acompanhamento components/API.

## Manual Functional Scenarios

### Scenario 1: Create a group from cards

1. Log in as Acompanhamento manager.
2. Open Acompanhamento > Projetos.
3. Select two visible mission cards from the same client.
4. Click "Unificar selecionadas".
5. Confirm/create the group.

Expected:

- One consolidated card appears.
- The two individual cards disappear from the grid.
- The consolidated card shows the group name and the included mission codes.
- A third unselected mission remains as an individual card.

### Scenario 2: Aggregated values are consistent

1. Before grouping, note planned cost, realized cost, invoiced revenue, invoice count, worked days and worked hours of two missions.
2. Create the group.
3. Compare the consolidated card.

Expected:

- Additive values equal the sum of the individual cards.
- Percentages are recalculated from consolidated totals.
- Member progress values remain visible inside the group card.

### Scenario 3: Dashboard respects groups

1. Open Acompanhamento > Dashboard.
2. Search for one of the grouped mission codes.

Expected:

- The consolidated row/card is findable by member code/name/client.
- Individual rows of grouped missions are hidden.
- KPIs and chart totals use the grouped row once, not children plus group.

### Scenario 4: Desmesclar restores individual missions

1. In Acompanhamento > Projetos, click "Desmesclar" on the consolidated card.
2. Confirm the action.
3. Reload the page.

Expected:

- The consolidated card disappears.
- Individual cards reappear with their original metrics.
- Dashboard also returns to individual mission rows.

### Scenario 5: Other modules remain independent

1. With a group active, open an individual mission detail or related report/RDO flow.
2. Check the mission identity and data.

Expected:

- The individual project/contract remains unchanged.
- Reports/RDOs are not grouped or renamed.
- Omie/imported financial data remains attached to individual projects.

## Responsive/Visual Checks

Validate at desktop and mobile widths:

- Selection controls fit inside `acp-filters` without page-level horizontal scroll.
- Card member list wraps cleanly.
- "Unificar selecionadas" disabled state is visible when fewer than 2 cards are selected.
- Desmesclar confirmation uses the shared dialog/modal pattern with accessible action buttons.
