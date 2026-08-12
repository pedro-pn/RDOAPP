export const TECHNICAL_CATALOG_VERSION = 1;
export const MAX_TECHNICAL_SERVICES = 11;
export const MAX_TECHNICAL_SERVICE_TEXT = 20_000;

export type TechnicalServiceId =
  | "flushing_primario"
  | "flushing_secundario"
  | "filtragem_hidraulico_lubrificante"
  | "filtragem_oleo_termico"
  | "desidratacao_oleo"
  | "desidratacao_oleo_diesel"
  | "limpeza_quimica"
  | "hidrojateamento"
  | "passagem_pig"
  | "teste_hidrostatico"
  | "pre_engenharia"
  | "limpeza_reservatorio";

export type TechnicalReportCode = "RCPU" | "RTP" | "RLR" | "RLQ";
export type ChemicalMaterial = "Aço carbono" | "Aço inoxidável" | "Outro metal";

export type TechnicalServiceParameters = {
  nasTarget?: string;
  ppmTarget?: string;
  material?: ChemicalMaterial;
  otherMaterial?: string;
  oilType?: "Óleo hidráulico" | "Óleo lubrificante";
};

export type TechnicalServiceSelection = {
  instanceId: string;
  serviceId: TechnicalServiceId;
  templateVersion: number;
  title: string;
  text: string;
  usesTemplate: boolean;
  parameters: TechnicalServiceParameters;
  reportCode: TechnicalReportCode | null;
};

export type TechnicalServiceDefinition = {
  id: TechnicalServiceId;
  title: string;
  summary: string;
  version: number;
  reportCode: TechnicalReportCode | null;
  asksNas?: boolean;
  asksPpm?: boolean;
  asksMaterial?: boolean;
  asksOilType?: boolean;
  defaultParameters: TechnicalServiceParameters;
  buildText: (parameters: TechnicalServiceParameters) => string;
};

export type TechnicalReportEntry = {
  code: "RDO" | TechnicalReportCode;
  serviceId?: TechnicalServiceId;
  serviceTitle?: string;
  text: string;
};

const FILTRATION_INTRO = `Para a retenção do particulado sólido será utilizado um sistema de filtragem com filtros absolutos de 03 micra, meio filtrante em fibra de vidro (Beta 1000), com eficiência de 99,9%, no retorno do sistema.

Análises, controle e monitoramento do sistema:

A filtragem absoluta será monitorada com contador eletrônico de partículas a laser. Serão realizadas análises periódicas na unidade de flushing/filtragem para verificar o índice de contaminação até que o grau de limpeza esteja em conformidade com a exigência solicitada pela Contratante.

Normas aplicadas: Classe ISO 4406 ou NAS 1638.

Nota: Quando aplicado o processo em óleos usados ou com coloração escura que impeça a leitura pelo contador de partículas a laser, o fluido circulará por pelo menos 2 horas, conforme o volume da carga. Não havendo saturação do elemento filtrante, o processo será considerado liberado.`;

function buildFlushingText(stage: "primário" | "secundário", parameters: TechnicalServiceParameters) {
  return `O flushing ${stage} será executado por circulação controlada do fluido definido para o processo, em regime turbulento, promovendo o arraste de partículas sólidas livres presentes no interior das tubulações.

O processo será acompanhado por inspeções e análises periódicas até que o grau de limpeza esteja em conformidade com a exigência solicitada pela Contratante.

Critério de liberação: ${parameters.nasTarget || "classe NAS a definir"} conforme NAS 1638.`;
}

function buildFiltrationText(parameters: TechnicalServiceParameters, thermal = false) {
  const fluid = thermal ? "óleo térmico" : (parameters.oilType || "óleo hidráulico ou lubrificante").toLowerCase();
  return `${FILTRATION_INTRO}

Fluido considerado: ${fluid}.

Critério de liberação: ${parameters.nasTarget || "classe NAS a definir"} conforme NAS 1638.

Critério de aceitação — utilização da quantidade de filtros prevista para o serviço, distribuída entre os equipamentos de filtragem. As quantidades e micragens definitivas deverão permanecer de acordo com o levantamento aprovado para a proposta.`;
}

function buildDehydrationText(parameters: TechnicalServiceParameters) {
  return `O serviço tem como objetivo remover a contaminação por água ou umidade presente no óleo, prejudicial tanto à saúde do fluido quanto ao equipamento.

Termovácuo:

O processo consiste na remoção de água dissolvida ou gases contaminantes presentes em uma carga de óleo. O óleo será succionado para uma câmara sob vácuo controlado. No circuito de sucção haverá aquecimento controlado eletronicamente, transmitindo calor ao óleo em circulação. Ao chegar à câmara de vácuo, o óleo será pulverizado, permitindo que a água e os gases dissolvidos sejam transformados em vapor e eliminados pela descarga da bomba de vácuo.

O processo acontecerá em circuito fechado entre o tanque de armazenamento, externo ou próprio do equipamento contaminado, e o equipamento termovácuo. O tempo de processamento variará conforme o grau de contaminação e o volume da carga de óleo.

Monitoramento:

Serão realizadas análises para verificar o teor de umidade até que o resultado esteja conforme a solicitação da Contratante.

Critério de liberação: máximo de ${parameters.ppmTarget || "200"} PPM de água no óleo.`;
}

function buildChemicalCleaningText(parameters: TechnicalServiceParameters) {
  const material = parameters.material === "Outro metal"
    ? parameters.otherMaterial?.trim() || "outro metal a especificar"
    : parameters.material || "material a definir";
  return `A limpeza química será planejada e executada com produtos, concentrações, temperaturas, tempos de circulação e critérios de controle compatíveis com ${material}.

Antes do início, serão confirmados o material construtivo, o volume do circuito, o tipo de contaminação, os pontos de circulação, amostragem, drenagem e as condições de segurança. A sequência operacional poderá contemplar desengraxe, remoção dos contaminantes, enxágue, neutralização, passivação e secagem, conforme a necessidade técnica do sistema.

Os produtos e parâmetros definitivos serão registrados no procedimento aprovado para o serviço, preservando a integridade do material e atendendo ao critério de liberação acordado com a Contratante.`;
}

export const TECHNICAL_SERVICE_CATALOG: TechnicalServiceDefinition[] = [
  {
    id: "flushing_primario",
    title: "Flushing primário",
    summary: "Circulação inicial e arraste de partículas livres do circuito.",
    version: 1,
    reportCode: "RCPU",
    asksNas: true,
    defaultParameters: { nasTarget: "NAS 6" },
    buildText: (parameters) => buildFlushingText("primário", parameters),
  },
  {
    id: "flushing_secundario",
    title: "Flushing secundário",
    summary: "Etapa complementar de circulação, filtragem e monitoramento.",
    version: 1,
    reportCode: "RCPU",
    asksNas: true,
    defaultParameters: { nasTarget: "NAS 6" },
    buildText: (parameters) => buildFlushingText("secundário", parameters),
  },
  {
    id: "filtragem_hidraulico_lubrificante",
    title: "Filtragem de óleo hidráulico/lubrificante",
    summary: "Filtragem absoluta com monitoramento da classe de limpeza.",
    version: 1,
    reportCode: "RCPU",
    asksNas: true,
    asksOilType: true,
    defaultParameters: { nasTarget: "NAS 6", oilType: "Óleo hidráulico" },
    buildText: (parameters) => buildFiltrationText(parameters),
  },
  {
    id: "filtragem_oleo_termico",
    title: "Filtragem de óleo térmico",
    summary: "Filtragem do óleo térmico com modelo técnico editável.",
    version: 1,
    reportCode: null,
    asksNas: true,
    defaultParameters: { nasTarget: "NAS 6" },
    buildText: (parameters) => buildFiltrationText(parameters, true),
  },
  {
    // O id NÃO muda, e isso é deliberado: `normalizeTechnicalServiceSelections`
    // descarta id desconhecido em silêncio, então renomear apagaria o serviço de
    // toda proposta já salva. O título é que ficou preciso — era ele o impreciso.
    id: "desidratacao_oleo",
    title: "Desidratação de óleo lubrificante/hidráulico",
    summary: "Remoção de água e gases por processo de termovácuo.",
    version: 1,
    reportCode: "RCPU",
    asksPpm: true,
    defaultParameters: { ppmTarget: "200" },
    buildText: buildDehydrationText,
  },
  {
    // Desvio nº 16: o comercial trata os dois fluidos como serviços DIFERENTES,
    // porque o preço difere. A referência tinha um só — e é um dos pontos em que
    // ela é esboço, não retrato do uso real.
    //
    // O texto é o mesmo por enquanto, e não por descuido: `buildDehydrationText`
    // fala de "óleo" do início ao fim, sem citar fluido. Se o comercial tiver
    // texto próprio para diesel, ele entra aqui.
    id: "desidratacao_oleo_diesel",
    title: "Desidratação de óleo diesel",
    summary: "Remoção de água e gases por processo de termovácuo.",
    version: 1,
    reportCode: "RCPU",
    asksPpm: true,
    defaultParameters: { ppmTarget: "200" },
    buildText: buildDehydrationText,
  },
  {
    id: "limpeza_quimica",
    title: "Limpeza química",
    summary: "Modelo condicionado ao material do sistema.",
    version: 1,
    reportCode: "RLQ",
    asksMaterial: true,
    defaultParameters: { material: "Aço carbono", otherMaterial: "" },
    buildText: buildChemicalCleaningText,
  },
  {
    id: "hidrojateamento",
    title: "Hidrojateamento",
    summary: "Preparação e limpeza por jato de água em alta pressão.",
    version: 1,
    reportCode: null,
    defaultParameters: {},
    buildText: () => `O hidrojateamento será executado com pressão, vazão, acessórios e distância de aplicação compatíveis com a superfície e com o contaminante a ser removido.

Antes da execução serão definidos o isolamento da área, a contenção dos resíduos, os acessos e os critérios de inspeção. A equipe realizará a limpeza de forma controlada, preservando a integridade dos componentes e registrando as condições encontradas e o resultado final.`,
  },
  {
    id: "passagem_pig",
    title: "Passagem de PIG",
    summary: "Limpeza interna de tubulações por passagem controlada de PIG.",
    version: 1,
    reportCode: null,
    defaultParameters: {},
    buildText: () => `A passagem de PIG será planejada conforme o diâmetro, o comprimento, as mudanças de direção, os pontos de lançamento e recebimento e as condições internas da tubulação.

Serão verificados os acessos, a continuidade do circuito, a compatibilidade do PIG e os meios de impulsão. As passagens serão executadas de forma controlada, com registro das condições de entrada e saída e repetição quando necessária ao atendimento do critério definido para o serviço.`,
  },
  {
    id: "teste_hidrostatico",
    title: "Teste hidrostático / teste de pressão",
    summary: "Ensaio com água e emissão automática de RTP.",
    version: 1,
    reportCode: "RTP",
    defaultParameters: {},
    buildText: () => `Os testes hidrostáticos serão efetuados com água, antes do processo de limpeza química, quando aplicável. A pressão de ensaio para sistemas hidráulicos deve ser de 1,2 a mais que a pressão de trabalho e, para sistemas lubrificantes, 1,5 a mais que a pressão de trabalho, salvo disposição em contrário na documentação do projeto. Os testes deverão ser executados com bomba apropriada, fornecida pela Contratada.

Nota: Quando realizado o teste hidrostático com água antes do processo de limpeza química, poderá ocorrer abertura em alguma porosidade na solda. Recomenda-se à Contratante a realização de ensaio por líquido penetrante e raio X para identificar possíveis porosidades ou imperfeições na solda antes da limpeza química.`,
  },
  {
    id: "pre_engenharia",
    title: "Pré-engenharia",
    summary: "Antecipação de riscos, soluções e condições de execução.",
    version: 1,
    reportCode: null,
    defaultParameters: {},
    buildText: () => `O principal objetivo da pré-engenharia é garantir que o projeto seja eficiente, seguro e economicamente viável, reduzindo riscos e evitando retrabalhos. Ela busca antecipar desafios e definir soluções antes da execução, garantindo uma implementação mais fluida e dentro das expectativas.`,
  },
  {
    id: "limpeza_reservatorio",
    title: "Limpeza interna de reservatório",
    summary: "Limpeza mecânica, espaço confinado e registros fotográficos.",
    version: 1,
    reportCode: "RLR",
    defaultParameters: {},
    buildText: () => `A limpeza interna de reservatórios tem como objetivo remover resíduos sólidos ou líquidos contaminantes presentes em seu interior, garantindo o funcionamento adequado do equipamento e prolongando sua vida útil. A limpeza mecânica também evita a contaminação excessiva do óleo filtrado durante o abastecimento.

Etapas previstas:

• Abertura da documentação;
• Abertura do tanque;
• Medição inicial dos gases;
• Ventilação forçada até atingir LEL seguro;
• Liberação da documentação para acesso ao espaço confinado;
• Acesso seguro ao espaço confinado com equipamentos EX;
• Limpeza interna do chão e das paredes do tanque;
• Montagem de andaime, quando necessária, sob responsabilidade da Contratante;
• Limpeza interna do teto e da parte superior das paredes;
• Medição final dos gases;
• Desgaseificação adicional, quando necessária, até manter atmosfera segura;
• Emissão dos relatórios e ART aplicável;
• Organização da área e desmobilização.`,
  },
];

const REPORT_CODES = new Set<TechnicalReportCode>(["RCPU", "RTP", "RLR", "RLQ"]);
const SERVICE_IDS = new Set<TechnicalServiceId>(TECHNICAL_SERVICE_CATALOG.map((service) => service.id));

export function getTechnicalServiceDefinition(id: TechnicalServiceId) {
  return TECHNICAL_SERVICE_CATALOG.find((service) => service.id === id);
}

export function createTechnicalServiceSelection(serviceId: TechnicalServiceId, instanceId: string) {
  const definition = getTechnicalServiceDefinition(serviceId);
  if (!definition) throw new Error("Modelo técnico não encontrado.");
  const parameters = { ...definition.defaultParameters };
  return {
    instanceId,
    serviceId,
    templateVersion: definition.version,
    title: definition.title,
    text: definition.buildText(parameters),
    usesTemplate: true,
    parameters,
    reportCode: definition.reportCode,
  } satisfies TechnicalServiceSelection;
}

export function updateTechnicalServiceParameter(
  selection: TechnicalServiceSelection,
  key: keyof TechnicalServiceParameters,
  value: string,
) {
  const definition = getTechnicalServiceDefinition(selection.serviceId);
  const parameters = { ...selection.parameters, [key]: value } as TechnicalServiceParameters;
  return {
    ...selection,
    parameters,
    text: selection.usesTemplate && definition ? definition.buildText(parameters) : selection.text,
    templateVersion: selection.usesTemplate && definition ? definition.version : selection.templateVersion,
  };
}

export function resetTechnicalServiceTemplate(selection: TechnicalServiceSelection) {
  const definition = getTechnicalServiceDefinition(selection.serviceId);
  if (!definition) return selection;
  return {
    ...selection,
    templateVersion: definition.version,
    text: definition.buildText(selection.parameters),
    usesTemplate: true,
  };
}

export function normalizeTechnicalServiceSelections(value: unknown) {
  if (!Array.isArray(value)) return [];
  const used = new Set<TechnicalServiceId>();
  return value.flatMap<TechnicalServiceSelection>((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const record = candidate as Record<string, unknown>;
    const serviceId = String(record.serviceId || "") as TechnicalServiceId;
    if (!SERVICE_IDS.has(serviceId) || used.has(serviceId) || used.size >= MAX_TECHNICAL_SERVICES) return [];
    const definition = getTechnicalServiceDefinition(serviceId);
    if (!definition) return [];
    used.add(serviceId);
    const parameters = normalizeParameters(record.parameters, definition);
    const hasText = Object.prototype.hasOwnProperty.call(record, "text");
    const hasTitle = Object.prototype.hasOwnProperty.call(record, "title");
    const storedText = String(record.text ?? "").trim().slice(0, MAX_TECHNICAL_SERVICE_TEXT);
    const storedTitle = String(record.title ?? "").trim().slice(0, 120);
    const storedCode = record.reportCode === null
      ? null
      : REPORT_CODES.has(record.reportCode as TechnicalReportCode)
        ? record.reportCode as TechnicalReportCode
        : definition.reportCode;
    return [{
      instanceId: String(record.instanceId || `${serviceId}-${index + 1}`).slice(0, 100),
      serviceId,
      templateVersion: positiveInteger(record.templateVersion) || definition.version,
      title: hasTitle ? storedTitle : definition.title,
      text: hasText ? storedText : definition.buildText(parameters),
      usesTemplate: record.usesTemplate !== false,
      parameters,
      reportCode: storedCode,
    }];
  });
}

export function validateTechnicalServiceSelections(selections: TechnicalServiceSelection[]) {
  const errors: string[] = [];
  if (!selections.length) return ["Selecione pelo menos um serviço técnico."];
  if (selections.length > MAX_TECHNICAL_SERVICES) errors.push(`Selecione no máximo ${MAX_TECHNICAL_SERVICES} serviços.`);
  for (const selection of selections) {
    const definition = getTechnicalServiceDefinition(selection.serviceId);
    if (!definition) {
      errors.push("Há um serviço técnico inválido.");
      continue;
    }
    if (!selection.title.trim()) errors.push(`${definition.title}: informe o título.`);
    if (!selection.text.trim()) errors.push(`${definition.title}: informe o texto técnico.`);
    if (selection.reportCode !== definition.reportCode) {
      errors.push(`${definition.title}: a configuração automática do relatório está inválida; remova e adicione o modelo novamente.`);
    }
    if (definition.asksNas && !selection.parameters.nasTarget?.trim()) {
      errors.push(`${definition.title}: informe a classe NAS desejada.`);
    }
    if (definition.asksPpm) {
      const ppm = Number(String(selection.parameters.ppmTarget || "").replace(",", "."));
      if (!Number.isFinite(ppm) || ppm <= 0) errors.push(`${definition.title}: informe um limite de PPM válido.`);
    }
    if (definition.asksOilType && !selection.parameters.oilType) {
      errors.push(`${definition.title}: selecione o tipo de óleo.`);
    }
    if (definition.asksMaterial) {
      if (!selection.parameters.material) errors.push(`${definition.title}: selecione o material.`);
      if (selection.parameters.material === "Outro metal" && !selection.parameters.otherMaterial?.trim()) {
        errors.push(`${definition.title}: especifique o outro metal.`);
      }
    }
  }
  return errors;
}

export function buildTechnicalReportEntries(selections: TechnicalServiceSelection[]) {
  const entries: TechnicalReportEntry[] = [{
    code: "RDO",
    text: "Será entregue diariamente o RDO (Relatório Diário de Obra), descrevendo os serviços executados no respectivo dia de trabalho.",
  }];
  for (const selection of selections) {
    if (!selection.reportCode) continue;
    entries.push({
      code: selection.reportCode,
      serviceId: selection.serviceId,
      serviceTitle: selection.title,
      text: reportText(selection.reportCode, selection),
    });
  }
  return entries;
}

export function buildTechnicalReportsText(selections: TechnicalServiceSelection[], additionalNotes = "") {
  const entries = buildTechnicalReportEntries(selections);
  const paragraphs = entries.map((entry, index) => `8.${index + 1} — ${entry.text}`);
  if (entries.length > 1) {
    paragraphs.splice(
      1,
      0,
      "Observação: visando reduzir tempo e retrabalho na manutenção dos relatórios, os relatórios específicos serão elaborados e entregues após a regularização e aprovação dos RDOs.",
    );
  }
  if (additionalNotes.trim()) paragraphs.push(`Informações complementares: ${additionalNotes.trim()}`);
  return paragraphs.join("\n\n");
}

export function technicalReportName(code: "RDO" | TechnicalReportCode) {
  return {
    RDO: "Relatório Diário de Obra",
    RCPU: "Relatório de Contagem de Partículas e Umidade",
    RTP: "Relatório de Teste de Pressão",
    RLR: "Relatório de Limpeza de Reservatório",
    RLQ: "Relatório de Limpeza Química",
  }[code];
}

function reportText(code: TechnicalReportCode, selection: TechnicalServiceSelection) {
  if (code === "RCPU") {
    // As duas desidratações emitem o mesmo relatório, com o mesmo texto: o que
    // as separa é preço e categoria no CRM, não o ensaio.
    if (
      selection.serviceId === "desidratacao_oleo" ||
      selection.serviceId === "desidratacao_oleo_diesel"
    ) {
      return `Após a conclusão do serviço de ${selection.title.toLowerCase()}, será emitido um RCPU (${technicalReportName(code)}) com os registros do teor de umidade inicial e final, para encaminhamento ao responsável pela fiscalização e aceitação dos serviços.`;
    }
    return `Após a conclusão do serviço de ${selection.title.toLowerCase()}, será emitido um RCPU (${technicalReportName(code)}) com os registros de contagem de partículas e umidade inicial e final, para encaminhamento ao responsável pela fiscalização e aceitação dos serviços.`;
  }
  if (code === "RTP") {
    return `Após a conclusão do serviço de ${selection.title.toLowerCase()}, será emitido um RTP (${technicalReportName(code)}) com os parâmetros do ensaio, pressão aplicada, duração, registros e resultado do teste.`;
  }
  if (code === "RLR") {
    return `Após a conclusão do serviço de ${selection.title.toLowerCase()}, será emitido um RLR (${technicalReportName(code)}) com registros fotográficos das condições anteriores e posteriores aos serviços.`;
  }
  return `Após a conclusão do serviço de ${selection.title.toLowerCase()}, será emitido um RLQ (${technicalReportName(code)}) com as etapas realizadas, parâmetros controlados, evidências e critérios de liberação aplicáveis.`;
}

function normalizeParameters(value: unknown, definition: TechnicalServiceDefinition) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const parameters: TechnicalServiceParameters = { ...definition.defaultParameters };
  const has = (key: string) => Object.prototype.hasOwnProperty.call(record, key);
  if (definition.asksNas) {
    parameters.nasTarget = String(has("nasTarget") ? record.nasTarget ?? "" : parameters.nasTarget || "").slice(0, 40);
  }
  if (definition.asksPpm) {
    parameters.ppmTarget = String(has("ppmTarget") ? record.ppmTarget ?? "" : parameters.ppmTarget || "").slice(0, 20);
  }
  if (definition.asksOilType) {
    parameters.oilType = !has("oilType")
      ? definition.defaultParameters.oilType
      : record.oilType === "Óleo lubrificante" || record.oilType === "Óleo hidráulico"
        ? record.oilType
        : undefined;
  }
  if (definition.asksMaterial) {
    parameters.material = !has("material")
      ? definition.defaultParameters.material
      : record.material === "Aço carbono" || record.material === "Aço inoxidável" || record.material === "Outro metal"
        ? record.material
        : undefined;
    parameters.otherMaterial = String(record.otherMaterial || "").slice(0, 80);
  }
  return parameters;
}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}
