/**
 * As 7 etapas da proposta e a **trava de avanço** (tarefas T055 e T056).
 *
 * Porte de `app/page.tsx:857-863` (o stepper) e do rodapé com o contador de
 * pendências. Módulo puro, sem React, pelo mesmo motivo da cadeia do rodapé de
 * custos: a regra é testável sozinha, e a tela não é.
 *
 * **A trava é diferente da tela de custos, e a diferença é deliberada.** Lá as abas
 * são livres e o rodapé apenas guia — porque o levantamento é uma calculadora e o
 * orçamentista vai e volta entre seções o tempo todo. Aqui a proposta é um documento
 * que se monta em ordem: não dá para avançar com a etapa incompleta, e o stepper só
 * deixa voltar para etapa já visitada (`index <= step`, na referência).
 */

export type EtapaProposta =
  | 'cliente'
  | 'escopo'
  | 'responsabilidades'
  | 'prazos'
  | 'tecnica'
  | 'comercial'
  | 'revisao';

export const ETAPAS: Array<{ value: EtapaProposta; label: string }> = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'escopo', label: 'Escopo' },
  { value: 'responsabilidades', label: 'Responsabilidades' },
  { value: 'prazos', label: 'Prazos' },
  { value: 'tecnica', label: 'Técnica' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'revisao', label: 'Revisão' }
];

export function indiceDaEtapa(etapa: EtapaProposta): number {
  const indice = ETAPAS.findIndex(item => item.value === etapa);
  return indice < 0 ? 0 : indice;
}

/** Uma pendência da etapa: o campo e o que falta nele. */
export type PendenciaEtapa = { campo: string; mensagem: string };

/**
 * Validadores de formato, portados da referência.
 *
 * Os dois seguem a mesma regra que o `Field` da referência já aplicava: **erro só
 * quando há valor e ele está errado**. Campo vazio é "obrigatório", não "inválido" —
 * são dois estados, e trocá-los faz o usuário procurar um erro de digitação num
 * campo que ele simplesmente não preencheu.
 */
export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

/**
 * CNPJ: 14 dígitos **e** dígitos verificadores corretos.
 *
 * A referência conferia só a quantidade (`cnpjDigits.length === 14`). Conferir os
 * verificadores é mais estrito — e o CNPJ vai impresso no documento fiscal do
 * cliente, onde um dígito trocado inutiliza a proposta inteira.
 */
export function cnpjValido(valor: string): boolean {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digitos)) return false;

  const verificador = (base: string, pesos: number[]) => {
    const soma = base
      .split('')
      .reduce((total, digito, i) => total + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const primeiro = verificador(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = verificador(digitos.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return primeiro === Number(digitos[12]) && segundo === Number(digitos[13]);
}

export function formatarCnpj(valor: string): string {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

type Formulario = Record<string, unknown>;

function texto(form: Formulario, campo: string): string {
  return String(form[campo] ?? '').trim();
}

/**
 * As pendências da etapa **Cliente e responsáveis** (`PROP-CTL-011..025`).
 *
 * A trava da referência: proposta, cliente, contato, e-mail válido, CNPJ válido,
 * local da obra, consultor de vendas e orçamentista.
 */
export function pendenciasDoCliente(form: Formulario): PendenciaEtapa[] {
  const faltando: PendenciaEtapa[] = [];

  const obrigatorios: Array<[string, string]> = [
    ['seller', 'Selecione o consultor de vendas.'],
    ['date', 'Informe a data de emissão.'],
    ['client', 'Informe o cliente.'],
    ['contact', 'Informe o contato.'],
    ['site', 'Informe o local da obra.']
  ];

  for (const [campo, mensagem] of obrigatorios) {
    if (!texto(form, campo)) faltando.push({ campo, mensagem });
  }

  const cnpj = texto(form, 'cnpj');
  if (!cnpj) faltando.push({ campo: 'cnpj', mensagem: 'Informe o CNPJ.' });
  else if (!cnpjValido(cnpj)) {
    faltando.push({ campo: 'cnpj', mensagem: 'Informe um CNPJ válido com 14 dígitos.' });
  }

  const email = texto(form, 'email');
  if (!email) faltando.push({ campo: 'email', mensagem: 'Informe o e-mail.' });
  else if (!emailValido(email)) {
    faltando.push({ campo: 'email', mensagem: 'Digite um e-mail válido.' });
  }

  return faltando;
}

/**
 * As pendências da etapa **Escopo comum** (`PROP-CTL-026..033`).
 *
 * A trava da referência: título da proposta, e **todo** item com título *e*
 * descrição. Um item pela metade atravessa para o documento como uma seção 2.x
 * numerada e vazia — o cliente vê o número e não vê o serviço.
 */
export function pendenciasDoEscopo(
  titulo: string,
  itens: Array<{ title?: string; description?: string }>
): PendenciaEtapa[] {
  const faltando: PendenciaEtapa[] = [];

  if (!String(titulo || '').trim()) {
    faltando.push({ campo: 'title', mensagem: 'Informe o título da proposta.' });
  }

  itens.forEach((item, i) => {
    if (!String(item.title || '').trim()) {
      faltando.push({ campo: `escopo[${i}].title`, mensagem: 'Informe o título do serviço.' });
    }
    if (!String(item.description || '').trim()) {
      faltando.push({
        campo: `escopo[${i}].description`,
        mensagem: 'Descreva o serviço.'
      });
    }
  });

  return faltando;
}

export type LinhaResponsabilidade = { item: string; owner: string; note: string };

/** "N/A" é resposta legítima: há obrigação que não cabe a ninguém no contrato e
 *  precisa constar assim mesmo, para não parecer esquecimento. */
export const RESPONSAVEIS = ['Filtrovali', 'Contratante', 'N/A'];

export function linhaVazia(): LinhaResponsabilidade {
  return { item: '', owner: 'Filtrovali', note: '' };
}

/**
 * As pendências da **matriz de responsabilidades** (`PROP-CTL-034..042`).
 *
 * Mais estrito que a referência, que exigia só a existência da linha. Linha em
 * branco atravessa para o documento como obrigação sem texto — pior do que a
 * ausência dela, porque parece que alguém quis dizer algo e não disse.
 */
export function pendenciasDasResponsabilidades(
  linhas: Array<{ item?: string }>
): PendenciaEtapa[] {
  const preenchidas = linhas.filter(linha => String(linha.item || '').trim()).length;
  return preenchidas > 0
    ? []
    : [
        {
          campo: 'responsabilidades',
          mensagem: 'Informe ao menos uma responsabilidade com o item preenchido.'
        }
      ];
}

/** As pendências de **Prazos e jornada** (`PROP-CTL-043..048`). */
export function pendenciasDosPrazos(form: Formulario): PendenciaEtapa[] {
  const obrigatorios: Array<[string, string]> = [
    ['attendance', 'Informe a previsão de atendimento.'],
    ['mobilization', 'Informe a mobilização após o pedido.'],
    ['permanence', 'Informe a permanência prevista em obra.'],
    ['execution', 'Informe o prazo efetivo de execução.'],
    ['workday', 'Descreva a jornada de trabalho.']
  ];

  return obrigatorios
    .filter(([campo]) => !texto(form, campo))
    .map(([campo, mensagem]) => ({ campo, mensagem }));
}

/**
 * As pendências da etapa ativa.
 *
 * As etapas ainda não portadas devolvem lista vazia **de propósito**: uma trava que
 * bloqueia sem ter o que validar prenderia o usuário numa etapa em branco. Quando a
 * etapa for portada, a validação dela entra aqui junto.
 */
export function pendenciasDaEtapa(
  etapa: EtapaProposta,
  form: Formulario,
  escopo: {
    itens?: Array<{ title?: string; description?: string }>;
    responsabilidades?: Array<{ item?: string }>;
  } = {}
): PendenciaEtapa[] {
  if (etapa === 'cliente') return pendenciasDoCliente(form);
  if (etapa === 'escopo') {
    return pendenciasDoEscopo(String(form.title ?? ''), escopo.itens || []);
  }
  if (etapa === 'responsabilidades') {
    return pendenciasDasResponsabilidades(escopo.responsabilidades || []);
  }
  if (etapa === 'prazos') return pendenciasDosPrazos(form);
  return [];
}

/** O texto do rodapé, na forma da referência: "Preencha N campo(s) obrigatório(s)". */
export function rotuloDoAvanco(pendencias: PendenciaEtapa[], ultima: boolean): string {
  if (pendencias.length === 0) return ultima ? 'Finalizar proposta →' : 'Avançar →';
  return pendencias.length === 1
    ? 'Preencha 1 campo obrigatório'
    : `Preencha ${pendencias.length} campos obrigatórios`;
}

/** Índice campo → mensagem, para a etapa consultar sem varrer a lista a cada campo. */
export function indiceDePendencias(pendencias: PendenciaEtapa[]) {
  const mapa = new Map<string, string>();
  for (const item of pendencias) if (!mapa.has(item.campo)) mapa.set(item.campo, item.mensagem);
  return mapa;
}
