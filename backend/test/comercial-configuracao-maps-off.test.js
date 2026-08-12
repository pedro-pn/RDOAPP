import assert from 'node:assert/strict';
import test from 'node:test';

// `off` é o PADRÃO do ambiente, e é por isso que este arquivo existe separado:
// o modo do Maps é lido uma vez, na carga do módulo, então não dá para desligá-lo
// no meio de `comercial-configuracao.test.js`.
process.env.GOOGLE_MAPS_MODE = 'off';

const { conferirEndereco, salvarSede } = await import('../src/lib/comercial/configuracao.js');

/**
 * Configurar a sede com o Google Maps desligado (T131).
 *
 * A instalação típica tem `GOOGLE_MAPS_MODE=off` — é o padrão dos três
 * adaptadores externos do módulo. Se salvar exigisse o `placeId`, a tela de
 * configuração seria inútil justamente aí, e o endereço da sede não teria como
 * ser informado por ninguém.
 *
 * O endereço digitado serve de origem sozinho. É como o cálculo funcionava antes
 * de existir `placeId`, e continua funcionando.
 */

const SEDE = 'Rua Rosa Orsi Dalçoquio, 930, Cordeiros, Itajaí - SC';

function prismaFalso() {
  let linha = null;
  return {
    comercialSettings: {
      findUnique: async () => (linha ? { ...linha } : null),
      upsert: async ({ create }) => {
        linha = { ...create, updatedAt: new Date('2026-08-12T12:00:00Z') };
        return { ...linha };
      }
    },
    get linhaAtual() {
      return linha;
    }
  };
}

/** Um `fetch` que denuncia: com o Maps off, ninguém deveria chegar à rede. */
const naoChame = async () => {
  throw new Error('saiu para a rede com o Maps desligado');
};

test('salvar grava o endereço mesmo sem poder localizá-lo', async () => {
  const prisma = prismaFalso();
  const config = await salvarSede(prisma, { username: 'gestor' }, { sedeEndereco: SEDE }, { buscar: naoChame });

  assert.equal(config.sedeEndereco, SEDE);
  assert.equal(config.sedePlaceId, '');
  // E diz por que não localizou, em vez de deixar o gestor achando que falhou.
  assert.match(config.aviso, /desligado/i);
});

test('conferir também responde, em vez de estourar', async () => {
  const local = await conferirEndereco(SEDE, { buscar: naoChame });

  assert.equal(local.placeId, '');
  assert.match(local.aviso, /desligado/i);
});
