import prisma from '../src/lib/prisma.js';
import { normalizeChecklistItems } from '../src/lib/equipamentos/equipment-checklist.js';

export const CHECKLIST_ITEMS_BY_PREFIX = {
  UFI: [
    'Drenagem e limpeza das carcaças dos filtros',
    'Limpeza da válvula de retenção',
    'Aperto dos parafusos do motor',
    'Aperto das conexões',
    'Aperto dos parafusos das válvulas',
    'Verificação do medidor de saturação dos filtros',
    'Troca do filtro de ar do painel',
    'Reaperto dos fios do painel',
    'Verificação dos rodízios do skid',
    'Verificação do varão',
    'Verificação das mangueiras hidráulicas',
    'Pintura',
    'Teste'
  ],
  UTH: [
    'Verificação do plug de alimentação',
    'Verfiicação do manômetro',
    'Verificação da vávlula agulha',
    'Condições das mangueiras',
    'Verificação da pintura',
    'Verificação dos rodízios',
    'Teste'
  ],
  UTO: [
    'Limpeza da carcaça do filtro',
    'Limpeza do Filtro Y',
    'Verificação das borrachas de vedação das câmaras de vácuo',
    'Verificação do acrílico das câmaras de vácuo',
    'Verificação das fiações do painel',
    'Verificação dos manômetros',
    'Verificação do filtro de ar',
    'Verificação do conduíte da fiação de alimentação',
    'Verificação da resistência',
    'Verificação das mangueiras',
    'Verificação de vazamentos',
    'Verificação da iluminação',
    'Verificação dos rodízios',
    'Abastecimento de óleo Lubrax AC 100',
    'Pintura',
    'Teste'
  ],
  UBP: [
    'Conferir engate rápido de ar',
    'Conferir o diafragma',
    'Apertar os parafusos',
    'Conferir as vedações',
    'Testar com água'
  ],
  ULQ: [
    'Verificação do sentido do giro do motor (roda sentido horário)',
    'Limpeza do tanque de alimentação',
    'Verificação do conduíte da fiação de alimentação',
    'Verificação da fiação do painel',
    'Verificação do manômetro e selo',
    'Verificação da mangueira do nível do tanque',
    'Verificação da conexão de inox e vazamentos',
    'Verificação do nível de óleo do motor e filtro do combustível',
    'Verificação de vazamentos no caracol',
    'Verificar o nível de óleo Diesel',
    'Verificar o cabo de bateria',
    'Verificar o aditivo do radiador e o filtro',
    'Limpeza',
    'Teste'
  ],
  UFP: [
    'Drenagem e limpeza das carcaças dos filtros',
    'Limpeza da válvula de retenção',
    'Aperto dos parafusos da bucha de expansão',
    'Aperto dos parafusos das válvulas',
    'Aperto das conexões',
    'Limpeza do medidor de vazão',
    'Troca do filtro de ar do painel',
    'Verificação das mangueiras de calibração dos pneus',
    'Pintura',
    'Teste'
  ],
  TRO: [
    'Revisar a tensão (voltagem)',
    'Revisar plug de alimentação',
    'Revisar os cabos',
    'Limpeza',
    'Teste'
  ]
};

export const UTH_008_EXTRA_ITEMS = [
  'Verificação da correia',
  'Verificação das polias'
];

export const SUGGESTED_CHECKLIST_ITEMS_BY_CATEGORY_NAME = {
  Mangueiras: [
    'Mangueira sem cortes, trincas, bolhas ou abrasão crítica',
    'Terminais e conexões íntegros, sem deformação',
    'Roscas e engates limpos e protegidos',
    'Pressão e classe de trabalho compatíveis com a aplicação',
    'Comprimento e bitola conferidos',
    'Ausência de vazamentos aparentes',
    'Tampões ou proteções instalados quando aplicável'
  ]
};

export const SUGGESTED_CHECKLIST_ITEMS_BY_STOCK_CATEGORY_NAME = {
  Filtros: [
    'Modelo e especificação conferidos',
    'Elemento filtrante íntegro e sem dano aparente',
    'Embalagem íntegra, limpa e seca',
    'Vedações e O-rings presentes e em boas condições',
    'Grau de filtração conferido',
    'Quantidade conferida',
    'Ausência de umidade ou contaminação visível'
  ],
  'Produtos químicos': [
    'Data de validade conferida',
    'Embalagem íntegra, sem vazamento, estufamento ou violação',
    'Rótulo e identificação do produto legíveis',
    'Lote identificado quando aplicável',
    'FISPQ disponível quando exigida',
    'Quantidade e unidade conferidas',
    'Condição de armazenamento e transporte adequada'
  ]
};

const SUGGESTED_CATEGORY_ALIASES = {
  Mangueiras: ['mangueiras', 'mangueira']
};

const SUGGESTED_STOCK_CATEGORY_ALIASES = {
  Filtros: ['filtros', 'filtro'],
  'Produtos químicos': ['produtos quimicos', 'produtos químicos', 'produto quimico', 'produto químico']
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function codePrefix(code) {
  return String(code || '').trim().split(/\s+/)[0]?.toUpperCase() || '';
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

export function resolveCategoryForPrefix(prefix, categories, equipment) {
  const categoryById = new Map(categories.map(category => [category.id, category]));
  const counts = new Map();
  for (const item of equipment) {
    if (codePrefix(item.code) !== prefix) continue;
    counts.set(item.categoryId, (counts.get(item.categoryId) || 0) + 1);
  }
  const [categoryId] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  if (categoryId && categoryById.has(categoryId)) return categoryById.get(categoryId);

  const target = normalizeText(prefix);
  return categories.find(category => (
    normalizeText(category.systemKey).includes(target)
    || normalizeText(category.name).includes(target)
  )) || null;
}

export function resolveCategoryForName(targetName, categories) {
  const aliases = SUGGESTED_CATEGORY_ALIASES[targetName] || [targetName];
  const normalizedAliases = aliases.map(normalizeText);
  return categories.find(category => (
    normalizedAliases.includes(normalizeText(category.name))
    || normalizedAliases.includes(normalizeText(category.systemKey))
  )) || null;
}

function categoryAction(category, key, rawItems, labelField = 'prefix') {
  const items = normalizeChecklistItems(rawItems);
  if (!category.checklistEnabled || !hasItems(category.checklistItems)) {
    return {
      id: category.id,
      name: category.name,
      [labelField]: key,
      checklistEnabled: true,
      checklistItems: hasItems(category.checklistItems) ? category.checklistItems : items
    };
  }
  return null;
}

export function planChecklistBackfill(categories, equipment, stockCategories = []) {
  const actions = {
    categories: [],
    equipment: [],
    stockCategories: [],
    missing: [],
    skipped: []
  };

  for (const [prefix, rawItems] of Object.entries(CHECKLIST_ITEMS_BY_PREFIX)) {
    const category = resolveCategoryForPrefix(prefix, categories, equipment);
    if (!category) {
      actions.missing.push({ type: 'category', prefix });
      continue;
    }
    const action = categoryAction(category, prefix, rawItems);
    if (action) {
      actions.categories.push(action);
    } else {
      actions.skipped.push({ type: 'category', prefix, id: category.id, reason: 'checklist já preenchido' });
    }
  }

  for (const [name, rawItems] of Object.entries(SUGGESTED_CHECKLIST_ITEMS_BY_CATEGORY_NAME)) {
    const category = resolveCategoryForName(name, categories);
    if (!category) {
      actions.missing.push({ type: 'category', name });
      continue;
    }
    const action = categoryAction(category, name, rawItems, 'suggestion');
    if (action) {
      actions.categories.push(action);
    } else {
      actions.skipped.push({ type: 'category', name, id: category.id, reason: 'checklist já preenchido' });
    }
  }

  for (const [name, rawItems] of Object.entries(SUGGESTED_CHECKLIST_ITEMS_BY_STOCK_CATEGORY_NAME)) {
    const aliases = SUGGESTED_STOCK_CATEGORY_ALIASES[name] || [name];
    const normalizedAliases = aliases.map(normalizeText);
    const category = (stockCategories || []).find(item => (
      normalizedAliases.includes(normalizeText(item.name))
    ));
    if (!category) {
      actions.missing.push({ type: 'stockCategory', name });
      continue;
    }
    const action = categoryAction(category, name, rawItems, 'suggestion');
    if (action) {
      actions.stockCategories.push(action);
    } else {
      actions.skipped.push({ type: 'stockCategory', name, id: category.id, reason: 'checklist já preenchido' });
    }
  }

  const uth008 = equipment.find(item => String(item.code || '').trim().toUpperCase() === 'UTH 008') || null;
  if (!uth008) {
    actions.missing.push({ type: 'equipment', code: 'UTH 008' });
  } else if (uth008.checklistItems !== null && uth008.checklistItems !== undefined) {
    actions.skipped.push({ type: 'equipment', code: 'UTH 008', id: uth008.id, reason: 'override já preenchido' });
  } else {
    actions.equipment.push({
      id: uth008.id,
      code: uth008.code,
      checklistItems: [...CHECKLIST_ITEMS_BY_PREFIX.UTH, ...UTH_008_EXTRA_ITEMS]
    });
  }

  return actions;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const help = process.argv.includes('--help') || process.argv.includes('-h');
  if (help) {
    console.log(`Uso: node scripts/backfill-checklist-items.js [--apply]

Preenche os checklists de categorias UFI, UTH, UTO, UBP, ULQ, UFP e TRO,
das categorias sugeridas de equipamentos quando existirem, e das categorias
de estoque Filtros e Produtos químicos.
Dry-run é o padrão. Use --apply para gravar.
`);
    return;
  }

  console.log(`[backfill-checklist-items] inicio${apply ? ' (apply)' : ' (dry-run)'}`);
  const [categories, equipment, stockCategories] = await Promise.all([
    prisma.equipmentCategory.findMany({ where: { isActive: true } }),
    prisma.companyEquipment.findMany({ where: { isActive: true } }),
    prisma.stockCategory.findMany({ where: { isActive: true } })
  ]);
  const plan = planChecklistBackfill(categories, equipment, stockCategories);

  for (const action of plan.categories) {
    const label = action.prefix || action.suggestion || action.name;
    console.log(`  ${apply ? '~' : 'dry'} categoria ${label} → ${action.name}: ${action.checklistItems.length} item(ns)`);
    if (apply) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.equipmentCategory.update({
        where: { id: action.id },
        data: {
          checklistEnabled: action.checklistEnabled,
          checklistItems: action.checklistItems
        }
      });
    }
  }

  for (const action of plan.equipment) {
    console.log(`  ${apply ? '~' : 'dry'} equipamento ${action.code}: override com ${action.checklistItems.length} item(ns)`);
    if (apply) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.companyEquipment.update({
        where: { id: action.id },
        data: { checklistItems: action.checklistItems }
      });
    }
  }

  for (const action of plan.stockCategories) {
    console.log(`  ${apply ? '~' : 'dry'} categoria estoque ${action.suggestion} → ${action.name}: ${action.checklistItems.length} item(ns)`);
    if (apply) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.stockCategory.update({
        where: { id: action.id },
        data: {
          checklistEnabled: action.checklistEnabled,
          checklistItems: action.checklistItems
        }
      });
    }
  }

  for (const item of plan.skipped) {
    console.log(`  = pulado ${item.type} ${item.prefix || item.name || item.code}: ${item.reason}`);
  }
  for (const item of plan.missing) {
    console.log(`  ! não encontrado ${item.type} ${item.prefix || item.name || item.code}`);
  }

  console.log(JSON.stringify({
    apply,
    categoriesUpdated: plan.categories.length,
    equipmentUpdated: plan.equipment.length,
    stockCategoriesUpdated: plan.stockCategories.length,
    skipped: plan.skipped.length,
    missing: plan.missing.length
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
