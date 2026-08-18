import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

let server;
let jornadas;

test.before(async () => {
  server = await createServer({
    configFile: false,
    root: new URL('..', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'custom'
  });
  jornadas = await server.ssrLoadModule(
    '/src/pages/comercial/custos/jornadas.ts'
  );
});

test.after(async () => {
  await server?.close();
});

const fase = {
  durationDays: 10,
  workingDays: 6,
  hoursPerDay: 8,
  weekdayExtra70HoursPerDay: 2,
  saturdayCount: 1,
  saturdayHoursPerDay: 6,
  sundayCount: 1,
  sundayHoursPerDay: 4
};

test('uma alocação sem cenário herda a jornada atual da fase', () => {
  const resultado = jornadas.jornadaDaAlocacao({ role: 'GERENTE' }, fase);

  assert.equal(resultado.targetType, 'role');
  assert.deepEqual(
    resultado.days.map((item) => [
      item.dayType,
      item.days,
      item.normalHoursPerDay,
      item.extraHoursPerDay,
      item.overtimePercent
    ]),
    [
      ['weekday', 6, 8, 2, 70],
      ['saturday', 1, 0, 6, 70],
      ['sunday_holiday', 1, 0, 4, 100]
    ]
  );
});

test('aplicar o horário para a equipe copia a escala e o turno, sem copiar o nome pessoal', () => {
  const escala = {
    name: 'Plantão de fim de semana',
    targetType: 'collaborator',
    collaboratorName: 'Maria',
    days: [
      {
        dayType: 'sunday_holiday',
        days: 2,
        normalHoursPerDay: 0,
        extraHoursPerDay: 10,
        overtimePercent: 100
      }
    ]
  };
  const equipe = [
    { id: 'a1', role: 'GERENTE', shift: 'day' },
    { id: 'a2', role: 'COORDENADOR', shift: 'day' }
  ];

  const resultado = jornadas.aplicarJornadaATodaEquipe(equipe, escala, 'night');

  assert.equal(resultado.length, 2);
  assert.ok(resultado.every((item) => item.shift === 'night'));
  assert.ok(resultado.every((item) => item.workSchedule.targetType === 'role'));
  assert.ok(resultado.every((item) => !item.workSchedule.collaboratorName));
  assert.deepEqual(resultado[0].workSchedule.days, escala.days);
  assert.notEqual(
    resultado[0].workSchedule.days,
    resultado[1].workSchedule.days
  );
});
