import { EQUIPAMENTOS_E_FERRAMENTAS_PADRAO } from '../../../../../shared/comercial/dist/modelo-documento.js';

type ServicoDoEscopo = { title?: string; description?: string };

const EQUIPAMENTO = {
  limpezaQuimica: '1 unidade de limpeza química',
  bombaPneumatica: '1 bomba pneumática',
  flushingPrimario: '1 unidade de flushing primário',
  filtragem: '1 unidade de filtragem absoluta/transferência',
  flushingSecundario: '1 unidade de flushing secundário',
  termovacuo: '1 termovácuo',
  centrifuga: '1 centrífuga',
  bombaTeste: '1 bomba de teste hidrostático',
  bombaRunOut: '1 bomba de run out',
  kittiwake: '1 Kittiwake',
  contadorParticulas: '1 contador eletrônico de partículas a laser',
  hidrojato: '1 hidrojato 20k/40k'
} as const;

const REGRAS: Array<{ termos: RegExp; equipamentos: string[] }> = [
  {
    termos: /limpeza quimica|decapagem|passivacao/,
    equipamentos: [EQUIPAMENTO.limpezaQuimica, EQUIPAMENTO.bombaPneumatica]
  },
  {
    // "Flushing" sem qualificador sugere as duas unidades; a decisão final
    // continua com o vendedor na lista de seleção.
    termos: /flushing/,
    equipamentos: [EQUIPAMENTO.flushingPrimario, EQUIPAMENTO.flushingSecundario]
  },
  {
    termos: /filtragem|transferencia/,
    equipamentos: [EQUIPAMENTO.filtragem]
  },
  {
    termos: /termovacuo|desidratacao.*oleo|desidratacao de oleo/,
    equipamentos: [EQUIPAMENTO.termovacuo]
  },
  {
    termos: /centrifugacao|centrifuga/,
    equipamentos: [EQUIPAMENTO.centrifuga]
  },
  {
    termos: /teste hidrostatico|teste de pressao/,
    equipamentos: [EQUIPAMENTO.bombaTeste]
  },
  { termos: /run out/, equipamentos: [EQUIPAMENTO.bombaRunOut] },
  {
    termos: /contagem de particulas|contador de particulas|classe de limpeza/,
    equipamentos: [EQUIPAMENTO.contadorParticulas]
  },
  {
    termos: /kittiwake|teor de agua|agua no oleo/,
    equipamentos: [EQUIPAMENTO.kittiwake]
  },
  { termos: /hidrojateamento|hidrojato/, equipamentos: [EQUIPAMENTO.hidrojato] }
];

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

/** Equipamentos recomendados pelos títulos e descrições do capítulo 2. */
export function equipamentosSugeridosPeloEscopo(
  servicos: ServicoDoEscopo[]
): string[] {
  const texto = normalizar(
    servicos.map(servico => `${servico.title || ''} ${servico.description || ''}`).join(' ')
  );
  const sugeridos = new Set<string>();

  for (const regra of REGRAS) {
    if (!regra.termos.test(texto)) continue;
    regra.equipamentos.forEach(equipamento => sugeridos.add(equipamento));
  }

  // Mantém a mesma ordem estável do catálogo impresso.
  return EQUIPAMENTOS_E_FERRAMENTAS_PADRAO.filter(item => sugeridos.has(item));
}
