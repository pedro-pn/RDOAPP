import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  ABERTURA_DESCRICAO_SERVICO,
  CONFIGURACOES_HIDROJATEAMENTO,
  EQUIPAMENTOS_E_FERRAMENTAS_PADRAO,
  EFETIVOS_HIDROJATEAMENTO,
  INDICE_COMERCIAL,
  INDICE_TECNICO,
  JORNADA_HIDROJATEAMENTO,
  JORNADA_PADRAO,
  MATRIZ_HIDROJATEAMENTO,
  MATRIZ_PADRAO,
  jornadaDoModelo,
  linhasDePrazo,
  matrizDoModelo,
  observacoesTecnicasDoModelo,
  tabelaStandby,
  tabelasDePrecoDoModelo,
  descricaoComAberturaTecnica,
  textoCondicoesPagamento,
} from '../../shared/comercial/dist/modelo-documento.js';
import * as modelo from '../../shared/comercial/dist/modelo-documento.js';

/**
 * O texto fixo dos documentos — tarefa T071a, desvio 12.
 *
 * O que este teste protege: `modelo-documento.ts` é a única coisa nesta pasta
 * que **não** é cópia byte a byte da referência, e portanto a única que nenhum
 * dos 16 goldens cobre. Sem teste, uma edição descuidada nele sai direto no PDF
 * que vai ao cliente.
 */

test('os índices batem palavra por palavra com os da referência', () => {
  // Esta é a evidência de que os .docx são a origem editorial do gerador: se um
  // dia divergirem, ou o documento mudou de estrutura ou alguém reescreveu o
  // índice à mão — nos dois casos é para parar e olhar, não para ajustar aqui.
  const referencia = join(homedir(), 'comercialAPP/app/proposal-pdf.ts');
  let fonte;
  try {
    fonte = readFileSync(referencia, 'utf8');
  } catch {
    // A referência congelada é local e descartável. Onde ela não estiver, o
    // teste não pode inventar uma resposta — some, e os outros seguem valendo.
    return;
  }

  const listaDe = nome => {
    const bloco = new RegExp(`const ${nome} = \\[([\\s\\S]*?)\\n\\];`).exec(fonte);
    assert.ok(bloco, `${nome} não existe mais em proposal-pdf.ts`);
    return [...bloco[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  };

  assert.deepEqual([...INDICE_COMERCIAL], listaDe('COMMERCIAL_INDEX'));
  assert.deepEqual([...INDICE_TECNICO], listaDe('TECHNICAL_INDEX'));
});

test('o texto de pagamento é o do documento, não o da referência', () => {
  const texto = textoCondicoesPagamento({
    adiantamento: '35%',
    prazoPagamento: '21',
    formaPagamento: 'Depósito em conta',
  });

  // O DEFAULT_PAYMENT herdado dizia "em até 7 (sete) dias corridos contados da
  // data de emissão da Nota Fiscal". O documento diz outra coisa. Se esta linha
  // voltar, o desvio 12 foi desfeito sem ninguém perceber.
  assert.ok(
    !/7 \(sete\) dias corridos/.test(texto),
    'o texto envelhecido da referência voltou',
  );
  assert.match(texto, /Medição quinzenal/);
  assert.match(texto, /a título de mobilização, 35% antecipado/i);
  assert.match(texto, /21 dias para o devido pagamento através de Depósito em conta/);
});

test('as três variáveis de pagamento são interpoladas, não cravadas', () => {
  // O .docx entregue está preenchido com 35%/21/depósito. Cravar esses valores
  // faria toda proposta sair com as condições de uma negociação específica.
  const texto = textoCondicoesPagamento({
    adiantamento: '50%',
    prazoPagamento: '30',
    formaPagamento: 'Boleto bancário',
  });
  assert.match(texto, /50%/);
  assert.match(texto, /30 dias/);
  assert.match(texto, /Boleto bancário/);
  assert.ok(!/35%/.test(texto));
  assert.ok(!/21 dias/.test(texto));
});

test('a tabela de stand-by reflete os quatro valores e formata em pt-BR', () => {
  const linhas = tabelaStandby({
    horaExtra: 250,
    standbyEquipe: 11250,
    standbyEquipamento: 5000,
    mobilizacaoExtra: 21900,
  });

  assert.equal(linhas.length, 3);
  //   é o espaço fino que o Intl põe depois de "R$" — comparar com espaço
  // comum falha e manda o programador "consertar" o formatador certo.
  assert.deepEqual(linhas[0], ['Stand-by de Equipe', 'R$ 11.250,00']);
  assert.deepEqual(linhas[2], [
    'Mobilização Extra (por evento ida e volta)',
    'R$ 21.900,00',
  ]);
});

test('toda linha da matriz tem responsável, categoria e escopo', () => {
  for (const matriz of [MATRIZ_PADRAO, MATRIZ_HIDROJATEAMENTO]) {
    for (const linha of matriz) {
      assert.ok(linha.item.trim(), 'linha sem escopo');
      assert.ok(linha.categoria.trim(), `${linha.item}: sem categoria`);
      assert.ok(
        linha.responsavel === 'Filtrovali' || linha.responsavel === 'Contratante',
        `${linha.item}: responsável inválido`,
      );
      assert.equal(typeof linha.nota, 'string');
    }
  }
});

test('o catálogo de equipamentos é a origem da lista do modelo padrão', () => {
  const linha = MATRIZ_PADRAO.find(
    item => item.categoria === 'EQUIPAMENTOS E FERRAMENTAS'
  );

  assert.ok(linha, 'o modelo padrão não tem linha de equipamentos');
  assert.deepEqual(linha.subitens, EQUIPAMENTOS_E_FERRAMENTAS_PADRAO);
  assert.ok(EQUIPAMENTOS_E_FERRAMENTAS_PADRAO.includes('1 unidade de flushing primário'));
});

test('cada descrição comercial começa com a abertura técnica sem duplicá-la', () => {
  const descricao = descricaoComAberturaTecnica('Circulação pressurizada.');
  assert.equal(
    descricao,
    `${ABERTURA_DESCRICAO_SERVICO} — Circulação pressurizada.`
  );

  const pronta = `${ABERTURA_DESCRICAO_SERVICO} para limpeza do circuito.`;
  assert.equal(descricaoComAberturaTecnica(pronta), pronta);
});

test('a matriz tem os dois lados, e a categoria agrupa em blocos contíguos', () => {
  // O Word desenha a categoria como subtítulo que ocupa a largura da tabela.
  // Duas linhas da mesma categoria separadas por outra categoria imprimiriam o
  // subtítulo duas vezes.
  for (const matriz of [MATRIZ_PADRAO, MATRIZ_HIDROJATEAMENTO]) {
    for (const lado of ['Filtrovali', 'Contratante']) {
      const doLado = matriz.filter(linha => linha.responsavel === lado);
      assert.ok(doLado.length > 0, `matriz sem o lado ${lado}`);

      const vistas = new Set();
      let anterior = null;
      for (const linha of doLado) {
        if (linha.categoria === anterior) continue;
        assert.ok(
          !vistas.has(linha.categoria),
          `${lado}: a categoria ${linha.categoria} reaparece depois de interrompida`,
        );
        vistas.add(linha.categoria);
        anterior = linha.categoria;
      }
    }
  }
});

test('a matriz herdada de caldeiraria não sobreviveu', () => {
  // O initialRows da referência trazia 17 linhas de solda que não aparecem em
  // nenhum dos quatro documentos. É matriz de outro negócio.
  const tudo = [...MATRIZ_PADRAO, ...MATRIZ_HIDROJATEAMENTO]
    .map(linha => linha.item)
    .join('\n');
  for (const intruso of ['soldador', 'esmerilhadeira', 'inspetor de solda']) {
    assert.ok(
      !new RegExp(intruso, 'i').test(tudo),
      `"${intruso}" veio junto da matriz herdada`,
    );
  }
});

test('hidrojateamento tem dois turnos de jornada, e o padrão tem um', () => {
  assert.equal(JORNADA_PADRAO.length, 1);
  assert.equal(JORNADA_HIDROJATEAMENTO.length, 2);

  // O turno OFFSHORE trabalha domingo e feriado, 11 horas. Imprimir só o
  // diurno faria a proposta prometer jornada que a equipe embarcada não cumpre.
  const offshore = JORNADA_HIDROJATEAMENTO.find(turno => /OFFSHORE/.test(turno.titulo));
  assert.ok(offshore, 'falta o turno OFFSHORE');
  assert.match(offshore.linhas.join(' '), /Segunda a domingo e feriados – 11 horas/);

  assert.deepEqual(jornadaDoModelo('padrao'), JORNADA_PADRAO);
  assert.deepEqual(jornadaDoModelo('hidrojateamento'), JORNADA_HIDROJATEAMENTO);
});

test('só hidrojateamento pede duas tabelas de preço', () => {
  // É o ponto que torna impossível resolver hidrojateamento por catálogo:
  // renderPriceTable da referência desenha uma tabela só.
  assert.equal(tabelasDePrecoDoModelo('padrao'), null);
  assert.deepEqual(tabelasDePrecoDoModelo('hidrojateamento'), ['ONSHORE', 'OFFSHORE']);
});

test('as duas matrizes são de fato diferentes', () => {
  assert.notDeepEqual(matrizDoModelo('padrao'), matrizDoModelo('hidrojateamento'));

  // A prova pontual: só o modelo padrão fornece óleo para flushing primário.
  const escopoPadrao = MATRIZ_PADRAO.map(linha => linha.item).join('\n');
  const escopoHidro = MATRIZ_HIDROJATEAMENTO.map(linha => linha.item).join('\n');
  assert.match(escopoPadrao, /flushing primário/);
  assert.ok(!/flushing primário/.test(escopoHidro));
  assert.match(escopoHidro, /bomba de hidrojato/);
});

test('o efetivo e a configuração cobrem as quatro combinações do documento', () => {
  // Comentários #2 e #3: definidos em reunião, e o que for definido permanece
  // na proposta. São opções entre as quais se escolhe — não texto fixo. Se
  // virassem um bloco só, o documento prometeria os quatro efetivos ao cliente.
  assert.equal(EFETIVOS_HIDROJATEAMENTO.length, 4);
  const combinacoes = EFETIVOS_HIDROJATEAMENTO.map(e => `${e.bicos}-${e.local}`);
  assert.deepEqual(
    [...combinacoes].sort(),
    ['1-OFFSHORE', '1-ONSHORE', '2-OFFSHORE', '2-ONSHORE'],
  );

  assert.equal(CONFIGURACOES_HIDROJATEAMENTO.length, 4);
  for (const configuracao of CONFIGURACOES_HIDROJATEAMENTO) {
    assert.ok(configuracao.itens.length > 0, `${configuracao.titulo}: sem itens`);
  }
});

test('as quatro linhas de prazo saem, inclusive a de integração', () => {
  // `dias_treinamento` sai impressa no documento e hoje não tem campo no app.
  // É a T071c — o teste existe para a linha não sumir enquanto o campo não vem.
  const linhas = linhasDePrazo({
    permanencia: '35',
    integracao: '1',
    execucao: '24',
    deslocamento: '4',
  });
  assert.equal(linhas.length, 4);
  assert.match(linhas.join('\n'), /Prazo previsto para integração – 1 dia\(s\);/);
  assert.match(linhas.join('\n'), /permanência em obra \(dias corridos\) – 35/);
});

test('a observação do revezamento só aparece em hidrojateamento', () => {
  const padrao = observacoesTecnicasDoModelo('padrao');
  const hidro = observacoesTecnicasDoModelo('hidrojateamento');
  assert.ok(!/revezamento/.test(padrao));
  assert.match(hidro, /revezamento entre o anjo e o hidrojatista.*1 hora consecutiva/s);
  assert.ok(hidro.startsWith(padrao), 'hidrojateamento acrescenta, não substitui');
});

/* --------------------------------------------------------------------------
 * Bloco de stand-by (T071d)
 * ----------------------------------------------------------------------- */

test('o item 9 sai em partes, porque a tabela fica no meio da prosa', () => {
  // O documento intercala: frase da hora extra, título do bloco, TABELA,
  // explicação de cada linha e só então as observações gerais. Um bloco de
  // texto só não teria onde encaixar a tabela.
  const { fraseHoraExtra, TITULO_BLOCO_STANDBY, TEXTO_EXPLICACAO_STANDBY, TEXTO_OBSERVACOES_GERAIS } =
    modelo;

  assert.match(fraseHoraExtra(250), /R\$\s?250,00/);
  assert.match(TITULO_BLOCO_STANDBY, /Stand by e Mobilização Adicional/);
  assert.match(TEXTO_EXPLICACAO_STANDBY, /^Stand-by de Equipe: quando/);
  assert.match(TEXTO_OBSERVACOES_GERAIS, /IGPM/);

  // A explicação fala "conforme a tabela acima" — se ela viesse antes da
  // tabela, o documento apontaria para o lugar errado.
  assert.match(TEXTO_EXPLICACAO_STANDBY, /conforme a tabela acima/);
});

test('o texto corrido continua existindo, e é a soma das partes na ordem', () => {
  const valores = {
    horaExtra: 250,
    standbyEquipe: 11250,
    standbyEquipamento: 5000,
    mobilizacaoExtra: 21900,
  };
  const corrido = modelo.textoObservacoesComerciais(valores);
  const partes = [
    modelo.fraseHoraExtra(250),
    modelo.TITULO_BLOCO_STANDBY,
    modelo.TEXTO_EXPLICACAO_STANDBY,
    modelo.TEXTO_OBSERVACOES_GERAIS,
  ];
  assert.equal(corrido, partes.join('\n\n'));
});
