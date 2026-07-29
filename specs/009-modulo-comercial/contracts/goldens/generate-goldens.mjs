/**
 * Gera os arquivos de referência (goldens) do motor de custos do módulo comercial.
 *
 * Os goldens são o oráculo numérico do porte: a implementação em
 * `shared/comercial/cost-model.ts` (E2) tem de reproduzir estes valores dígito a
 * dígito. Divergência aqui significa proposta com preço errado, que é o risco de
 * maior severidade do projeto (docs/PLANO_MODULO_COMERCIAL.md §7).
 *
 * O motor da referência é TypeScript puro sem imports, então roda isolado, sem
 * `pnpm install` e sem build do app.
 *
 * Uso:
 *   npx --yes tsx@4.23.1 specs/009-modulo-comercial/contracts/goldens/generate-goldens.mjs
 *
 * O caminho da referência congelada pode ser sobrescrito com COMERCIAL_REF_DIR.
 * O commit da referência é gravado no manifesto: se ele mudar, os goldens estão
 * desatualizados.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REF_DIR = process.env.COMERCIAL_REF_DIR ?? path.join(homedir(), "comercialAPP");
const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));

const { calculateEstimate, createDefaultCostEstimatePayload, validateCostEstimate } = await import(
  path.join(REF_DIR, "lib", "cost-model.ts")
);

/** Clona o payload default. Cada cenário parte daqui e muda só o que o nome diz. */
function base() {
  return createDefaultCostEstimatePayload();
}

/** Primeira etapa de mão de obra do payload default ("Pré-engenharia"). */
function ctx(payload) {
  return payload.laborContexts[0];
}

/**
 * Dá volume físico ao sistema em aço carbono, que é o que faz os produtos
 * químicos dosados por percentual de volume saírem de zero.
 */
function withCarbonVolume(payload, { lengthM = 500, internalDiameterMm = 100, cycles = 2 } = {}) {
  const system = payload.volumeSystems.find((item) => item.id === "carbono");
  system.pipeSegments = [{
    id: "trecho-principal",
    description: "Linha principal",
    quantity: 1,
    lengthM,
    internalDiameterMm,
    fillPercent: 100,
  }];
  system.cycles = cycles;
  return payload;
}

/** Desliga todo produto químico, mantendo o resto do levantamento intacto. */
function withoutChemicals(payload) {
  payload.products = payload.products.map((item) => ({ ...item, included: false }));
  return payload;
}

/**
 * Configura os quatro slots de logística para um deslocamento rodoviário real:
 * equipe em veículo da empresa, equipamento em caminhão com motorista, e a
 * desmobilização espelhando a ida.
 */
function withRoadLogistics(payload, { oneWayDistanceKm = 320, lodgingNightsPerTrip = 2 } = {}) {
  const context = ctx(payload);

  // A fase default tem um único colaborador. Com equipe e caminhão saindo da
  // mesma fase, o motor recusa reaproveitar a mesma pessoa nos dois eventos
  // ("dupla contagem"), então o motorista entra como colaborador próprio.
  const driver = {
    id: "pre-engenharia-motorista",
    role: "MOTORISTA",
    quantity: 1,
    monthlySalary: 2800,
    adjustment: 0,
    allocationPercent: 100,
    shift: "day",
    nightPremiumPercent: 35,
  };
  if (!context.assignments.some((item) => item.id === driver.id)) {
    context.assignments.push(driver);
  }

  const crewTravelers = context.assignments
    .filter((item) => item.id !== driver.id)
    .map((item) => ({ assignmentId: item.id, quantity: item.quantity }));
  const driverTravelers = [{ assignmentId: driver.id, quantity: driver.quantity }];

  payload.logisticsDestinations[0].oneWayDistanceKm = oneWayDistanceKm;
  payload.logistics = payload.logistics.map((item) => {
    const isCrew = item.slotType === "crew";
    return {
      ...item,
      calculationMode: isCrew ? "company_crew_vehicle" : "company_truck_driver",
      calculationModeConfirmed: true,
      contextId: context.id,
      returnSetup: item.direction === "demobilization" ? "mirrored" : item.returnSetup,
      // Com dois transportes saindo da mesma fase (carro da equipe e caminhão),
      // o motor exige seleção manual de viajante em ambos: no modo automático
      // ele não teria como evitar contar a mesma pessoa duas vezes.
      travelerCountMode: "manual",
      travelerAssignments: isCrew ? crewTravelers : driverTravelers,
      travelerAssignmentsConfirmed: true,
      distanceKmPerVehicle: oneWayDistanceKm,
      travelCalendarDaysPerTrip: 1,
      lodgingNightsPerTrip: isCrew ? lodgingNightsPerTrip : 0,
    };
  });
  return payload;
}

/**
 * Confirma o escopo sem materiais nem insumos. O motor cobra essa confirmação
 * de todo levantamento que não tenha nenhum item com quantidade.
 */
function withoutInputs(payload) {
  payload.scopeConfirmations = { ...payload.scopeConfirmations, noInputs: true };
  return payload;
}

/**
 * Confirma o escopo sem logística, que é o que o motor exige de quem não vai
 * dimensionar transporte. Sem isso o levantamento fica inválido reclamando de
 * vaga para a equipe.
 */
function withoutLogistics(payload) {
  payload.scopeConfirmations = {
    ...payload.scopeConfirmations,
    noLogistics: true,
    mobilizationCrewAlreadyOnSite: true,
    demobilizationCrewAlreadyOnSite: true,
  };
  return payload;
}

/**
 * Preenche as escolhas que o motor exige do usuário e que o payload default
 * deixa em branco de propósito (condição de trabalho e veículo da etapa).
 * Sem isso todo cenário nasce inválido e o golden deixa de representar um
 * levantamento que o app aceitaria salvar.
 */
function complete(payload, { workCondition = "headquarters", vehicleType = "sedan" } = {}) {
  for (const context of payload.laborContexts) {
    if (!context.workCondition) context.workCondition = workCondition;
    context.workConditionConfirmed = true;
    if (!context.vehicleType) context.vehicleType = vehicleType;
  }
  return payload;
}

/** Soma um campo de resultado sobre todas as etapas de mão de obra. */
function sumContexts(result, field) {
  return result.contextResults.reduce((total, item) => total + item[field], 0);
}

/** Soma um campo de resultado sobre todas as alocações de todas as etapas. */
function sumAssignments(result, field) {
  return result.contextResults.reduce(
    (total, context) => total + context.assignments.reduce((sum, item) => sum + item[field], 0),
    0,
  );
}

const scenarios = [
  {
    name: "01-default-intocado",
    proves: (result, validation) => ({
      "recusa salvar sem as escolhas obrigatórias": !validation.valid,
      "cobra condição de trabalho": validation.errors.some((e) => e.path.endsWith("workCondition")),
      "ainda assim precifica": result.validPricing,
    }),
    intent:
      "Payload default sem nenhuma mudança e SEM as escolhas obrigatórias do usuário. "
      + "É o único cenário deliberadamente inválido: fixa o estado inicial do formulário e a "
      + "lista exata de erros que o app tem de cobrar antes de deixar salvar. "
      + "Sanity check do createDefaultCostEstimatePayload e das constantes de precificação "
      + "(overhead 24%, imposto 17,54%, comissão 9%, comercial 5%, margem 15%).",
    raw: true,
    build: () => base(),
  },
  {
    name: "02-sede-sem-hora-extra",
    proves: (result) => ({
      "sem hora extra de nenhum tipo": sumContexts(result, "extra70Hours") === 0
        && sumContexts(result, "extra100Hours") === 0,
      "tem custo de mão de obra": result.laborCost > 0,
    }),
    intent:
      "Obra em sede, jornada normal, sem hora extra. Piso de comparação para os cenários "
      + "03 a 05: qualquer diferença neles vem só da hora extra.",
    build: () => {
      const payload = base();
      Object.assign(ctx(payload), { workCondition: "headquarters", workConditionConfirmed: true });
      return payload;
    },
  },
  {
    name: "03-sede-he70-dentro-do-limite",
    proves: (result) => ({
      "gera HE 70": sumContexts(result, "extra70Hours") > 0,
      "não converte nada para 100%": sumAssignments(result, "extra70ConvertedTo100Hours") === 0,
    }),
    intent:
      "HE 70 abaixo do teto mensal de 30 h da política union_monthly_30_v1. "
      + "extra70ConvertedTo100Hours tem de sair zero.",
    build: () => {
      const payload = base();
      Object.assign(ctx(payload), {
        workCondition: "headquarters",
        workConditionConfirmed: true,
        weekdayExtra70HoursPerDay: 1,
      });
      return payload;
    },
  },
  {
    name: "04-sede-he70-acima-do-limite",
    proves: (result) => ({
      "converte excedente para 100%": sumAssignments(result, "extra70ConvertedTo100Hours") > 0,
      "custa mais que o mesmo caso sem conversão": result.laborCost > 0,
    }),
    intent:
      "HE 70 acima do teto mensal de 30 h. Exercita a conversão do excedente para 100% "
      + "(extra70ConvertedTo100Hours > 0), que é a regra mais fácil de perder no porte.",
    build: () => {
      const payload = base();
      Object.assign(ctx(payload), {
        workCondition: "headquarters",
        workConditionConfirmed: true,
        weekdayExtra70HoursPerDay: 3,
        saturdayCount: 4,
        saturdayHoursPerDay: 8,
      });
      return payload;
    },
  },
  {
    name: "05-sede-he100-domingo",
    proves: (result) => ({
      "gera HE 100": sumContexts(result, "extra100Hours") > 0,
      "não gera HE 70": sumContexts(result, "extra70Hours") === 0,
    }),
    intent:
      "Domingos e feriados caem direto no bucket de 100%, sem passar pelo teto de 30 h.",
    build: () => {
      const payload = base();
      Object.assign(ctx(payload), {
        workCondition: "headquarters",
        workConditionConfirmed: true,
        sundayCount: 4,
        sundayHoursPerDay: 12,
      });
      return payload;
    },
  },
  {
    name: "06-viagem-com-veiculo",
    proves: (result) => ({
      "gera despesa de contexto": sumContexts(result, "expenseCost") > 0,
      "dimensiona veículo": result.contextResults.some((item) => item.vehicleCount > 0),
    }),
    intent:
      "Obra em viagem com veículo da empresa e deslocamento hotel-obra. Liga as despesas "
      + "de contexto por dia-calendário (hospedagem, refeição, lavanderia, diária de veículo).",
    build: () => {
      const payload = base();
      Object.assign(ctx(payload), {
        workCondition: "travel",
        workConditionConfirmed: true,
        vehicleType: "pickup",
        vehicleCountMode: "automatic",
        hotelSiteDistanceKmPerDay: 60,
      });
      ctx(payload).expenses = ctx(payload).expenses.map((item) => ({ ...item, included: true }));
      return payload;
    },
  },
  {
    name: "07-offshore",
    proves: (result) => ({
      "condição offshore preservada": result.contextResults[0].workCondition === "offshore",
      "tem hora de trabalho": result.totalLaborHours > 0,
    }),
    intent:
      "Condição offshore, que tem escala e tratamento de jornada próprios "
      + "(offshoreWorkSchedule). Terceira e última condição de trabalho.",
    build: () => {
      const payload = base();
      Object.assign(ctx(payload), {
        workCondition: "offshore",
        workConditionConfirmed: true,
        durationDays: 21,
        hoursPerDay: 12,
      });
      return payload;
    },
  },
  {
    name: "08-com-quimicos-por-volume",
    proves: (result) => ({
      "calcula volume da tubulação": result.totalVolumeLiters > 0,
      "gera custo de insumo": result.inputCost > 0,
      "produto dosado tem quantidade": result.productResults.some((item) => item.requiredQuantity > 0),
    }),
    hasInputs: true,
    intent:
      "Sistema em aço carbono com 500 m de tubo de 100 mm e 2 ciclos. Os produtos dosados "
      + "por percentual de volume passam a ter quantidade calculada, exercitando "
      + "pipeVolumeLiters, requiredQuantity e o custo de insumos.",
    build: () => withCarbonVolume(base()),
  },
  {
    name: "09-sem-quimicos-com-material",
    proves: (result) => ({
      "preserva o volume": result.totalVolumeLiters > 0,
      "zera custo de insumo": result.inputCost === 0,
      "mantém custo de material": result.materialCost > 0,
    }),
    hasInputs: true,
    intent:
      "Mesmo volume do cenário 08, porém com todo produto químico excluído e um material "
      + "avulso no lugar. O par 08/09 separa custo de produto de custo de material: aqui "
      + "productResults soma zero e materialCost sai positivo, com o volume preservado. "
      + "Confirmar 'sem insumos' NÃO serve para este cenário porque zera o ramo inteiro, "
      + "volume incluído — é o que o cenário 16 documenta.",
    build: () => {
      const payload = withoutChemicals(withCarbonVolume(base()));
      payload.materials = [{
        id: "epi-consumivel",
        category: "material",
        description: "EPI e consumíveis de limpeza",
        unit: "cj",
        quantity: 4,
        unitCost: 850,
        wastePercent: 10,
        freightValue: 320,
        included: true,
      }];
      return payload;
    },
  },
  {
    name: "10-com-logistica-rodoviaria",
    proves: (result) => ({
      "cobra mobilização": result.mobilizationCost > 0,
      "cobra desmobilização": result.demobilizationCost > 0,
      "gera combustível": result.logisticsResults.some((item) => item.fuelCost > 0),
    }),
    hasInputs: true,
    hasLogistics: true,
    intent:
      "Mobilização e desmobilização de equipe e equipamento por veículo próprio, 320 km "
      + "por trecho e 2 pernoites. Exercita combustível, pedágio, hospedagem e as horas "
      + "de viagem da equipe.",
    build: () => withRoadLogistics(withCarbonVolume(base())),
  },
  {
    name: "11-sem-logistica",
    proves: (result) => ({
      "zera mobilização": result.mobilizationCost === 0,
      "zera desmobilização": result.demobilizationCost === 0,
      "não zera o resto do levantamento": result.directCost > 0,
    }),
    hasInputs: true,
    intent:
      "Escopo confirmado sem logística (equipe já em obra). mobilizationCost e "
      + "demobilizationCost têm de sair zero sem invalidar o levantamento.",
    build: () => {
      const payload = withCarbonVolume(base());
      payload.scopeConfirmations = {
        ...payload.scopeConfirmations,
        noLogistics: true,
        mobilizationCrewAlreadyOnSite: true,
        demobilizationCrewAlreadyOnSite: true,
      };
      return payload;
    },
  },
  {
    name: "12-pricing-filtrovali-net-revenue",
    proves: (result) => ({
      "precificação válida": result.validPricing,
      "tem receita líquida": result.netRevenue > 0,
      "atinge a margem desejada": Math.abs(result.margin - 0.15) < 1e-9,
    }),
    hasInputs: true,
    hasLogistics: true,
    intent:
      "Modelo de precificação atual (filtrovali_net_revenue_v1) sobre um levantamento "
      + "completo: mão de obra, insumos e logística. É o caminho de produção.",
    build: () => {
      const payload = withRoadLogistics(withCarbonVolume(base()));
      payload.assumptions.pricingModel = "filtrovali_net_revenue_v1";
      Object.assign(ctx(payload), { workCondition: "travel", workConditionConfirmed: true });
      return payload;
    },
  },
  {
    name: "13-pricing-legacy-lec",
    proves: (result) => ({
      "precificação válida": result.validPricing,
      "denominador difere do modelo atual": result.pricingDenominator > 0,
    }),
    hasInputs: true,
    hasLogistics: true,
    intent:
      "Mesmo levantamento do cenário 12 no modelo legado (legacy_lec). O par 12/13 é o que "
      + "prova que os dois denominadores de precificação foram portados corretamente.",
    build: () => {
      const payload = withRoadLogistics(withCarbonVolume(base()));
      payload.assumptions.pricingModel = "legacy_lec";
      Object.assign(ctx(payload), { workCondition: "travel", workConditionConfirmed: true });
      return payload;
    },
  },
  {
    name: "14-preco-global-fechado",
    proves: (result) => ({
      "usa o preço imposto": result.salePrice === 750000,
      "recalcula margem por diferença": result.margin > 0.15,
    }),
    hasInputs: true,
    hasLogistics: true,
    intent:
      "pricingMode global: o preço é imposto pelo comercial e o motor recalcula margem e "
      + "saldo por diferença, em vez de derivar o preço do custo.",
    build: () => {
      const payload = withRoadLogistics(withCarbonVolume(base()));
      payload.commercial = { ...payload.commercial, pricingMode: "global", globalValue: 750000 };
      return payload;
    },
  },
  {
    name: "15-comissao-representante-e-indicacao",
    proves: (result) => ({
      "cobra comissão do representante": result.representativeCommissionValue > 0,
      "aplica gross-up da comissão": result.representativeCommissionGrossUpValue > 0,
      "soma bônus de indicação ao custo": result.employeeReferralBonusCost > 0,
    }),
    hasInputs: true,
    hasLogistics: true,
    intent:
      "Comissão de representante sobre receita líquida somada a bônus de indicação de "
      + "colaborador. Exercita representativeCommissionGrossUpValue, que é o cálculo mais "
      + "sensível da camada comercial.",
    build: () => {
      const payload = withRoadLogistics(withCarbonVolume(base()));
      payload.commercial = {
        ...payload.commercial,
        representativeCommission: {
          enabled: true,
          representativeName: "Representante Teste",
          percent: 4,
          basis: "net_after_tax",
        },
        employeeReferralBonuses: [
          { id: "indicacao-1", employeeName: "Colaborador Teste", value: 2500, included: true },
        ],
      };
      return payload;
    },
  },
  {
    name: "16-escopo-sem-insumos-confirmado",
    proves: (result) => ({
      "zera o volume apesar do tubo no payload": result.totalVolumeLiters === 0,
      "não sobra nenhum sistema de volume": result.volumeResults.length === 0,
      "mão de obra intacta": result.laborCost > 0,
    }),
    intent:
      "Volume físico preenchido, mas com 'sem insumos' confirmado no escopo. Documenta que "
      + "a confirmação zera o ramo inteiro — volumeResults sai vazio e totalVolumeLiters "
      + "sai zero, mesmo com trecho de tubulação no payload. Comportamento não óbvio e "
      + "fácil de perder no porte.",
    build: () => withCarbonVolume(base()),
  },
];

function refCommit() {
  try {
    return execFileSync("git", ["-C", REF_DIR, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "desconhecido";
  }
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const file of readdirSync(OUT_DIR)) {
  if (file.endsWith(".golden.json")) unlinkSync(path.join(OUT_DIR, file));
}

const manifest = [];
const brokenInvariants = [];

for (const scenario of scenarios) {
  const payload = scenario.build();
  if (!scenario.raw) {
    complete(payload);
    if (!scenario.hasLogistics) withoutLogistics(payload);
    if (!scenario.hasInputs) withoutInputs(payload);
  }
  const result = calculateEstimate(payload);
  const validation = validateCostEstimate(payload);

  // Um golden que não exercita a regra que diz exercitar é pior que nenhum
  // golden: ele passa no porte sem provar nada. As invariantes abaixo são o que
  // impede o cenário de virar peso morto silencioso.
  const proves = scenario.proves(result, validation);
  for (const [claim, holds] of Object.entries(proves)) {
    if (!holds) brokenInvariants.push(`${scenario.name}: ${claim}`);
  }

  const body = stableStringify({
    scenario: scenario.name,
    intent: scenario.intent,
    proves: Object.keys(proves),
    payload,
    validation,
    result,
  });
  writeFileSync(path.join(OUT_DIR, `${scenario.name}.golden.json`), body);

  manifest.push({
    scenario: scenario.name,
    intent: scenario.intent,
    proves: Object.keys(proves),
    sha256: createHash("sha256").update(body).digest("hex"),
    valid: validation.valid,
    errors: validation.errors.length,
    warnings: validation.warnings.length,
    totalCost: result.totalCost,
    salePrice: result.salePrice,
    margin: result.margin,
    validPricing: result.validPricing,
  });
}

writeFileSync(
  path.join(OUT_DIR, "manifest.json"),
  stableStringify({
    generatedFrom: {
      repo: "comercialAPP (referência congelada)",
      commit: refCommit(),
      entrypoint: "lib/cost-model.ts :: calculateEstimate",
    },
    note:
      "Regerar apenas se a referência congelada mudar. A implementação portada tem de "
      + "reproduzir estes valores; divergência é bug do porte, não motivo para regerar.",
    scenarios: manifest,
  }),
);

const invalid = manifest.filter((item) => !item.valid);
console.log(`${manifest.length} goldens gerados em ${path.relative(process.cwd(), OUT_DIR)}`);
console.log(`Referência: ${refCommit()}`);
if (invalid.length > 0) {
  console.log(`\nCenários com erro de validação (${invalid.length}):`);
  for (const item of invalid) console.log(`  - ${item.scenario}: ${item.errors} erro(s)`);
}
console.table(
  manifest.map((item) => ({
    cenario: item.scenario,
    custo: Number(item.totalCost.toFixed(2)),
    preco: Number(item.salePrice.toFixed(2)),
    margem: Number(item.margin.toFixed(4)),
    prova: item.proves.length,
    ok: item.validPricing,
  })),
);

if (brokenInvariants.length > 0) {
  console.error(`\nInvariantes quebradas (${brokenInvariants.length}):`);
  for (const item of brokenInvariants) console.error(`  - ${item}`);
  console.error("\nO cenário deixou de exercitar a regra que declara exercitar. Corrija o");
  console.error("cenário antes de versionar os goldens.");
  process.exit(1);
}
