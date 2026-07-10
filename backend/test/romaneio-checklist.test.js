import assert from 'node:assert/strict';
import test from 'node:test';

import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';

import {
  normalizeChecklistItems,
  resolveChecklistDisplayName,
  resolveEffectiveChecklist
} from '../src/lib/equipamentos/equipment-checklist.js';
import {
  buildRomaneioChecklistDocx,
  buildChecklistFileName,
  buildChecklistProjectLabel,
  shouldRegenerateChecklistPdf
} from '../src/lib/romaneio/romaneio-checklist-docx.js';
import {
  buildRomaneioChecklistMap,
  buildRomaneioChecklistSnapshots,
  buildRomaneioChecklistUpdateSnapshots,
  resolveRequiredChecklistSignatureImage,
  resolveChecklistSignatureImage
} from '../src/routes/resources/romaneios.js';
import {
  CHECKLIST_ITEMS_BY_PREFIX,
  SUGGESTED_CHECKLIST_ITEMS_BY_CATEGORY_NAME,
  SUGGESTED_CHECKLIST_ITEMS_BY_STOCK_CATEGORY_NAME,
  UTH_008_EXTRA_ITEMS,
  planChecklistBackfill,
  resolveCategoryForPrefix
} from '../scripts/backfill-checklist-items.js';

test('normalizeChecklistItems trims text, removes empty entries, and preserves order', () => {
  assert.deepEqual(
    normalizeChecklistItems(['  Drenar filtros  ', '', 'Limpar válvula', '   ', 'Inspecionar mangueiras']),
    ['Drenar filtros', 'Limpar válvula', 'Inspecionar mangueiras']
  );
});

test('normalizeChecklistItems limits item length and total items', () => {
  const long = 'a'.repeat(350);
  const items = Array.from({ length: 110 }, (_, index) => (index === 0 ? long : `Item ${index}`));
  const normalized = normalizeChecklistItems(items);

  assert.equal(normalized.length, 100);
  assert.equal(normalized[0].length, 300);
  assert.equal(normalized[99], 'Item 99');
});

test('resolveEffectiveChecklist inherits category items when equipment has no override', () => {
  const category = { checklistEnabled: true, checklistItems: [' Item A ', 'Item B'] };
  const equipment = { checklistItems: null };

  assert.deepEqual(resolveEffectiveChecklist(equipment, category), ['Item A', 'Item B']);
});

test('resolveEffectiveChecklist uses equipment override instead of category items', () => {
  const category = { checklistEnabled: true, checklistItems: ['Categoria'] };
  const equipment = { checklistItems: [' Próprio ', ''] };

  assert.deepEqual(resolveEffectiveChecklist(equipment, category), ['Próprio']);
});

test('resolveEffectiveChecklist allows an empty equipment override', () => {
  const category = { checklistEnabled: true, checklistItems: ['Categoria'] };
  const equipment = { checklistItems: [] };

  assert.deepEqual(resolveEffectiveChecklist(equipment, category), []);
});

test('resolveEffectiveChecklist returns empty list when category checklist is disabled', () => {
  const category = { checklistEnabled: false, checklistItems: ['Categoria'] };
  const equipment = { checklistItems: ['Próprio'] };

  assert.deepEqual(resolveEffectiveChecklist(equipment, category), []);
});

test('resolveChecklistDisplayName uses tag for unit equipment and name for consumables', () => {
  assert.equal(
    resolveChecklistDisplayName({
      catalogItem: { sourceType: 'EQUIPAMENTOS', code: 'UFP 001', name: 'Unidade de Filtragem', measureType: 'UNIT', isSerialized: true },
      displayMode: 'AUTO'
    }),
    'UFP 001'
  );
  assert.equal(
    resolveChecklistDisplayName({
      catalogItem: { sourceType: 'STOCK', code: 'PQ 010', name: 'Produto químico X', measureType: 'WEIGHT', isSerialized: false },
      displayMode: 'AUTO'
    }),
    'Produto químico X'
  );
  assert.equal(
    resolveChecklistDisplayName({
      catalogItem: { sourceType: 'EQUIPAMENTOS', code: 'ULQ 002', name: 'Unidade de Limpeza', measureType: 'UNIT', isSerialized: true },
      displayMode: 'NAME'
    }),
    'Unidade de Limpeza'
  );
});

test('buildRomaneioChecklistMap includes stock items using stock checklist', async () => {
  const client = {
    romaneioCatalogItem: {
      findMany: async () => [{
        id: 'catalog-pq',
        sourceType: 'STOCK',
        sourceId: 'stock-pq',
        code: 'PQ-001',
        name: 'Desengraxante',
        categoryName: 'Produtos químicos',
        measureType: 'WEIGHT',
        isSerialized: false
      }]
    },
    companyEquipment: {
      findMany: async () => []
    },
    stockItem: {
      findMany: async () => [{
        id: 'stock-pq',
        code: 'PQ-001',
        name: 'Desengraxante',
        checklistEnabled: false,
        checklistItems: null,
        category: {
          name: 'Produtos químicos',
          checklistEnabled: true,
          checklistItems: ['Validade conferida']
        },
        isActive: true
      }]
    }
  };

  const map = await buildRomaneioChecklistMap(client);

  assert.deepEqual(map['catalog-pq'].items, ['Validade conferida']);
  assert.equal(map['catalog-pq'].categoryName, 'Produtos químicos');
  assert.equal(map['catalog-pq'].displayNameOrTag, 'Desengraxante');
});

test('buildRomaneioChecklistSnapshots stores explicit item statuses and ignores unknown texts', () => {
  const snapshots = buildRomaneioChecklistSnapshots(
    [
      { catalogItemId: 'cat-1', itemCode: 'UFP 001', itemName: 'Unidade', sortOrder: 0 },
      { catalogItemId: 'cat-2', itemCode: 'SEM', itemName: 'Sem checklist', sortOrder: 1 }
    ],
    {
      'cat-1': {
        equipmentId: 'eq-1',
        equipmentCode: 'UFP 001',
        equipmentName: 'Unidade de Filtragem',
        categoryName: 'UFP',
        displayNameOrTag: 'UFP 001',
        displayMode: 'AUTO',
        items: ['Drenar filtros', 'Limpar válvula']
      }
    },
    [{
      catalogItemId: 'cat-1',
      statuses: [
        { text: 'Drenar filtros', status: 'NAO_APLICAVEL' },
        { text: 'Limpar válvula', status: 'NAO_CONFORME' },
        { text: 'Texto desconhecido', status: 'CONFORME' }
      ]
    }]
  );

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].catalogItemId, 'cat-1');
  assert.equal(snapshots[0].categoryName, 'UFP');
  assert.equal(snapshots[0].displayNameOrTag, 'UFP 001');
  assert.deepEqual(snapshots[0].items, [
    { text: 'Drenar filtros', status: 'NAO_APLICAVEL', checked: false },
    { text: 'Limpar válvula', status: 'NAO_CONFORME', checked: false }
  ]);
});

test('buildRomaneioChecklistSnapshots converts legacy checked texts to conforming statuses', () => {
  const snapshots = buildRomaneioChecklistSnapshots(
    [{ catalogItemId: 'cat-1', itemCode: 'UFP 001', itemName: 'Unidade', sortOrder: 0 }],
    {
      'cat-1': {
        equipmentId: 'eq-1',
        equipmentCode: 'UFP 001',
        equipmentName: 'Unidade',
        categoryName: 'UFP',
        displayNameOrTag: 'UFP 001',
        items: ['Drenar filtros', 'Limpar válvula']
      }
    },
    [{ catalogItemId: 'cat-1', checkedTexts: ['Limpar válvula'] }]
  );

  assert.deepEqual(snapshots[0].items, [
    { text: 'Drenar filtros', status: 'NAO_CONFORME', checked: false },
    { text: 'Limpar válvula', status: 'CONFORME', checked: true }
  ]);
});

test('buildRomaneioChecklistSnapshots defaults items to conforming when payload entry is absent', () => {
  const snapshots = buildRomaneioChecklistSnapshots(
    [{ catalogItemId: 'cat-1', itemCode: 'UTH 008', itemName: 'Unidade', sortOrder: 0 }],
    {
      'cat-1': {
        equipmentId: 'eq-1',
        equipmentCode: 'UTH 008',
        equipmentName: 'Unidade',
        categoryName: 'UTH',
        displayNameOrTag: 'UTH 008',
        items: ['Correia']
      }
    },
    []
  );

  assert.deepEqual(snapshots[0].items, [{ text: 'Correia', status: 'CONFORME', checked: true }]);
});

test('buildRomaneioChecklistUpdateSnapshots preserves existing snapshot texts and statuses over live checklist map', () => {
  const snapshots = buildRomaneioChecklistUpdateSnapshots(
    [{ catalogItemId: 'cat-1', itemCode: 'UFP 001', itemName: 'Unidade nova', sortOrder: 0 }],
    [{
      catalogItemId: 'cat-1',
      equipmentId: 'eq-1',
      equipmentCode: 'UFP 001',
      equipmentName: 'Unidade antiga',
      categoryName: 'UFP antigo',
      displayNameOrTag: 'UFP 001',
      displayMode: 'TAG',
      items: [{ text: 'Texto antigo', status: 'NAO_APLICAVEL', checked: false }]
    }],
    {
      'cat-1': {
        equipmentId: 'eq-1',
        equipmentCode: 'UFP 001',
        equipmentName: 'Unidade nova',
        items: ['Texto novo']
      }
    },
    []
  );

  assert.deepEqual(snapshots[0].items, [{ text: 'Texto antigo', status: 'NAO_APLICAVEL', checked: false }]);
  assert.equal(snapshots[0].equipmentName, 'Unidade antiga');
  assert.equal(snapshots[0].categoryName, 'UFP antigo');
  assert.equal(snapshots[0].displayNameOrTag, 'UFP 001');
});

test('buildChecklistFileName sanitizes invalid path characters and uses dd-mm-yyyy date', () => {
  const name = buildChecklistFileName({ project: { code: '123/45', name: 'Missão' }, romaneioDate: new Date('2026-07-09T12:00:00.000Z') });

  assert.equal(name, 'Checklist - Missão 123_45 - 09-07-2026.pdf');
});

test('buildChecklistProjectLabel uses code plus name or only code when name is pending', () => {
  assert.equal(buildChecklistProjectLabel({ project: { code: '123', name: 'Cliente A' } }), '123 - Cliente A');
  assert.equal(buildChecklistProjectLabel({ project: { code: '123', name: '' } }), '123');
});

test('shouldRegenerateChecklistPdf detects project label changes', () => {
  const romaneio = { project: { code: '123', name: 'Cliente A' } };

  assert.equal(shouldRegenerateChecklistPdf({ checklistProjectLabel: '123' }, romaneio), true);
  assert.equal(shouldRegenerateChecklistPdf({ checklistProjectLabel: '123 - Cliente A' }, romaneio), false);
  assert.equal(shouldRegenerateChecklistPdf({ projectLabel: '123 - Cliente A' }, romaneio), false);
});

function docText(node, out = []) {
  if (!node) return '';
  if (node.nodeType === 3) out.push(node.data || '');
  for (let child = node.firstChild; child; child = child.nextSibling) docText(child, out);
  return out.join('');
}

test('buildRomaneioChecklistDocx duplicates the checklist table for every snapshot', async () => {
  const buffer = await buildRomaneioChecklistDocx(
    {
      project: { code: '123', name: 'Cliente A' },
      romaneioDate: new Date('2026-07-09T12:00:00.000Z'),
      checklistResponsibleName: 'Responsável',
      checklistSignatureImage: null
    },
    [
      {
        categoryName: 'UFP',
        displayNameOrTag: 'UFP 001',
        equipmentCode: 'UFP 001',
        equipmentName: 'Unidade de Filtragem',
        items: [
          { text: 'Drenar filtros', status: 'CONFORME', checked: true },
          { text: 'Limpar válvula', status: 'NAO_CONFORME', checked: false },
          { text: 'N/A operacional', status: 'NAO_APLICAVEL', checked: false }
        ]
      },
      {
        categoryName: 'ULQ',
        displayNameOrTag: 'ULQ 002',
        equipmentCode: 'ULQ 002',
        equipmentName: 'Unidade de Limpeza',
        items: [{ text: 'Teste', status: 'CONFORME', checked: true }]
      }
    ]
  );
  const zip = new AdmZip(buffer);
  const doc = new DOMParser().parseFromString(zip.readAsText('word/document.xml'), 'text/xml');
  const fullText = docText(doc);
  const tableTexts = Array.from(doc.getElementsByTagName('w:tbl')).map(table => docText(table));

  assert.match(fullText, /UFP/);
  assert.match(fullText, /UFP 001/);
  assert.match(fullText, /ULQ/);
  assert.match(fullText, /ULQ 002/);
  assert.match(fullText, /CONFORME/);
  assert.match(fullText, /NÃO CONFORME/);
  assert.match(fullText, /NÃO APLICÁVEL/);
  assert.equal(tableTexts.filter(text => text.includes('Drenar filtros') || text.includes('Teste')).length, 2);
  assert.equal(fullText.includes('<<categoria>>'), false);
  assert.equal(fullText.includes('<<nomeoutag>>'), false);
});

test('resolveChecklistSignatureImage prefers payload signature', async () => {
  const payload = 'data:image/png;base64,payload';
  const client = {
    collaborator: {
      findUnique: async () => {
        throw new Error('collaborator lookup should not run');
      }
    }
  };

  assert.equal(await resolveChecklistSignatureImage({ collaboratorId: 'col-1' }, payload, client), payload);
});

test('resolveChecklistSignatureImage falls back to collaborator signature without mutation', async () => {
  const signature = 'data:image/png;base64,stored';
  const calls = [];
  const client = {
    collaborator: {
      findUnique: async args => {
        calls.push(['findUnique', args]);
        return { signatureImage: signature };
      },
      update: async args => {
        calls.push(['update', args]);
        return {};
      }
    }
  };

  assert.equal(await resolveChecklistSignatureImage({ collaboratorId: 'col-1' }, null, client), signature);
  assert.deepEqual(calls, [['findUnique', {
    where: { id: 'col-1' },
    select: { signatureImage: true }
  }]]);
});

test('resolveRequiredChecklistSignatureImage reuses existing romaneio signature', async () => {
  const signature = 'data:image/png;base64,existing';
  const client = {
    collaborator: {
      findUnique: async () => {
        throw new Error('collaborator lookup should not run');
      }
    }
  };

  assert.equal(await resolveRequiredChecklistSignatureImage({ collaboratorId: 'col-1' }, null, signature, client), signature);
});

test('resolveRequiredChecklistSignatureImage rejects checklist without any signature', async () => {
  const client = {
    collaborator: {
      findUnique: async () => ({ signatureImage: null })
    }
  };

  await assert.rejects(
    () => resolveRequiredChecklistSignatureImage({ collaboratorId: 'col-1' }, null, null, client),
    error => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Assinatura do responsável é obrigatória/);
      return true;
    }
  );
});

test('resolveCategoryForPrefix uses equipment code prefix before name fallback', () => {
  const categories = [
    { id: 'cat-a', name: 'Categoria A', systemKey: 'categoria_a' },
    { id: 'cat-ufp', name: 'Unidades de Filtragem', systemKey: 'unit_filtragem' }
  ];
  const equipment = [
    { code: 'UFP 001', categoryId: 'cat-ufp' },
    { code: 'UFP 002', categoryId: 'cat-ufp' },
    { code: 'UFP 003', categoryId: 'cat-a' }
  ];

  assert.equal(resolveCategoryForPrefix('UFP', categories, equipment)?.id, 'cat-ufp');
});

test('planChecklistBackfill does not overwrite existing category checklist items', () => {
  const plan = planChecklistBackfill(
    [{ id: 'cat-ufp', name: 'UFP', systemKey: 'ufp', checklistEnabled: true, checklistItems: ['Manual'] }],
    [{ id: 'eq-1', code: 'UFP 001', categoryId: 'cat-ufp', checklistItems: null }]
  );

  assert.equal(plan.categories.some(action => action.id === 'cat-ufp'), false);
  assert.ok(plan.skipped.some(item => item.type === 'category' && item.prefix === 'UFP'));
});

test('planChecklistBackfill includes suggested stock category checklists when present', () => {
  const plan = planChecklistBackfill(
    [
      { id: 'cat-mangueiras', name: 'Mangueiras', systemKey: 'mangueiras', checklistEnabled: false, checklistItems: [] }
    ],
    [],
    [
      { id: 'stock-filtros', type: 'FILTRO', name: 'Filtros', checklistEnabled: false, checklistItems: [] },
      { id: 'stock-pq', type: 'PRODUTO_QUIMICO', name: 'Produtos químicos', checklistEnabled: false, checklistItems: [] }
    ]
  );

  assert.deepEqual(
    plan.categories
      .filter(action => action.suggestion)
      .map(action => [action.suggestion, action.checklistItems]),
    Object.entries(SUGGESTED_CHECKLIST_ITEMS_BY_CATEGORY_NAME)
  );
  assert.deepEqual(
    plan.stockCategories.map(action => [action.suggestion, action.checklistItems]),
    Object.entries(SUGGESTED_CHECKLIST_ITEMS_BY_STOCK_CATEGORY_NAME)
  );
});

test('planChecklistBackfill composes UTH 008 override when none exists', () => {
  const plan = planChecklistBackfill(
    [{ id: 'cat-uth', name: 'UTH', systemKey: 'uth', checklistEnabled: false, checklistItems: [] }],
    [{ id: 'eq-uth-008', code: 'UTH 008', categoryId: 'cat-uth', checklistItems: null }]
  );

  const override = plan.equipment.find(action => action.id === 'eq-uth-008');
  assert.ok(override);
  assert.deepEqual(override?.checklistItems, [...CHECKLIST_ITEMS_BY_PREFIX.UTH, ...UTH_008_EXTRA_ITEMS]);
});

test('planChecklistBackfill reports missing categories and UTH 008 without aborting', () => {
  const plan = planChecklistBackfill([], []);

  assert.ok(plan.missing.some(item => item.type === 'category' && item.prefix === 'UFI'));
  assert.ok(plan.missing.some(item => item.type === 'equipment' && item.code === 'UTH 008'));
});
