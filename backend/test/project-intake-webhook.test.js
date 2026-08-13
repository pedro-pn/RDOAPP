import assert from 'node:assert/strict';
import { PassThrough, Readable, Writable } from 'node:stream';
import test from 'node:test';

import app from '../src/app.js';
import env from '../src/config/env.js';
import prisma from '../src/lib/prisma.js';
import {
  ProjectIntakeConflictError,
  projectIntakeCreateData,
  projectIntakeSchema,
  receiveProjectIntake
} from '../src/lib/project-intake.js';

const validPayload = {
  code: '005719',
  name: 'Ilha Solteira',
  clientName: 'Cliente Exemplo S.A.',
  clientCnpj: '12.345.678/0001-90',
  contractCode: 'CT-2026-001',
  location: 'Ilha Solteira - SP'
};

function dispatchApp(method, pathName, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = new Readable({
      read() {
        if (payload) this.push(payload);
        this.push(null);
      }
    });
    req.method = method;
    req.url = pathName;
    req.headers = {
      host: '127.0.0.1',
      ...(payload ? {
        'content-type': 'application/json',
        'content-length': String(payload.length)
      } : {}),
      ...headers
    };
    req.socket = new PassThrough();
    req.socket.remoteAddress = '198.51.100.20';
    req.socket.encrypted = false;
    req.connection = req.socket;

    const chunks = [];
    const responseHeaders = new Map();
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });
    res.statusCode = 200;
    res.setHeader = (name, value) => responseHeaders.set(String(name).toLowerCase(), value);
    res.getHeader = name => responseHeaders.get(String(name).toLowerCase());
    res.getHeaders = () => Object.fromEntries(responseHeaders);
    res.removeHeader = name => responseHeaders.delete(String(name).toLowerCase());
    res.writeHead = (statusCode, headersToSet = {}) => {
      res.statusCode = statusCode;
      Object.entries(headersToSet).forEach(([name, value]) => res.setHeader(name, value));
      return res;
    };
    res.end = (chunk, encoding, callback) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      Writable.prototype.end.call(res, callback);
      const rawBody = Buffer.concat(chunks).toString('utf8');
      resolve({ statusCode: res.statusCode, json: rawBody ? JSON.parse(rawBody) : null });
      return res;
    };

    app.handle(req, res, reject);
  });
}

function projectFromPayload(payload = validPayload, overrides = {}) {
  return {
    id: 'project-1',
    ...projectIntakeSchema.parse(payload),
    registrationPending: true,
    ...overrides
  };
}

function stubProjectClient(t, { existing = null, created = projectFromPayload(), createError = null, concurrent = null } = {}) {
  const originalFindUnique = prisma.project.findUnique;
  const originalCreate = prisma.project.create;
  let findCount = 0;
  const calls = [];
  prisma.project.findUnique = async args => {
    calls.push(['findUnique', args]);
    findCount += 1;
    return findCount === 1 ? existing : concurrent;
  };
  prisma.project.create = async args => {
    calls.push(['create', args]);
    if (createError) throw createError;
    return created;
  };
  t.after(() => {
    prisma.project.findUnique = originalFindUnique;
    prisma.project.create = originalCreate;
  });
  return calls;
}

function configureToken(t, token) {
  const original = env.projectIntakeWebhookToken;
  env.projectIntakeWebhookToken = token;
  t.after(() => {
    env.projectIntakeWebhookToken = original;
  });
}

test('project intake schema trims text, preserves leading zeroes and normalizes punctuation from CNPJ', () => {
  const parsed = projectIntakeSchema.parse({
    ...validPayload,
    code: ' 005719 ',
    name: ' Ilha Solteira ',
    clientCnpj: '12.345.678/0001-90'
  });

  assert.equal(parsed.code, '005719');
  assert.equal(parsed.name, 'Ilha Solteira');
  assert.equal(parsed.clientCnpj, '12345678000190');
});

test('project intake schema rejects missing, extra and invalid CNPJ fields', () => {
  assert.throws(() => projectIntakeSchema.parse({ ...validPayload, location: '' }));
  assert.throws(() => projectIntakeSchema.parse({ ...validPayload, clientCnpj: '1234567890123' }));
  assert.throws(() => projectIntakeSchema.parse({ ...validPayload, clientCnpj: '123456789012345' }));
  assert.throws(() => projectIntakeSchema.parse({ ...validPayload, unexpected: 'field' }));
});

test('project intake defaults keep a new project pending and operationally restricted', () => {
  const data = projectIntakeCreateData(projectIntakeSchema.parse(validPayload));
  assert.equal(data.registrationPending, true);
  assert.equal(data.visibleToCollaborators, false);
  assert.equal(data.managerOnly, false);
  assert.equal(data.clientEmailPrimary, '');
  assert.deepEqual(data.clientEmailCc, []);
  assert.deepEqual(data.clientSigners, []);
});

test('POST /api/webhooks/projects returns 503 when the integration is not configured', async t => {
  configureToken(t, '');
  const response = await dispatchApp('POST', '/api/webhooks/projects', validPayload);
  assert.equal(response.statusCode, 503);
  assert.equal(response.json.code, 'PROJECT_WEBHOOK_NOT_CONFIGURED');
});

test('POST /api/webhooks/projects returns the same 401 for missing and invalid tokens', async t => {
  configureToken(t, 'secret-token');
  const missing = await dispatchApp('POST', '/api/webhooks/projects', validPayload);
  const invalid = await dispatchApp('POST', '/api/webhooks/projects', validPayload, {
    authorization: 'Bearer wrong-token'
  });
  assert.equal(missing.statusCode, 401);
  assert.equal(invalid.statusCode, 401);
  assert.deepEqual(missing.json, invalid.json);
});

test('POST /api/webhooks/projects creates and returns a normalized pending project', async t => {
  configureToken(t, 'secret-token');
  const calls = stubProjectClient(t);
  const response = await dispatchApp('POST', '/api/webhooks/projects', {
    ...validPayload,
    code: ' 005719 ',
    name: ' Ilha Solteira '
  }, { authorization: 'Bearer secret-token' });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json.status, 'created');
  const createCall = calls.find(([name]) => name === 'create');
  assert.equal(createCall[1].data.code, '005719');
  assert.equal(createCall[1].data.clientCnpj, '12345678000190');
  assert.equal(createCall[1].data.registrationPending, true);
});

test('receiveProjectIntake treats an identical pending or reviewed project as idempotent without mutation', async () => {
  for (const registrationPending of [true, false]) {
    let createCount = 0;
    const existing = projectFromPayload(validPayload, { registrationPending });
    const result = await receiveProjectIntake(validPayload, {
      project: {
        async findUnique() { return existing; },
        async create() { createCount += 1; }
      }
    });
    assert.equal(result.status, 'already_exists');
    assert.equal(result.project.registrationPending, registrationPending);
    assert.equal(createCount, 0);
  }
});

test('receiveProjectIntake rejects a divergent existing project without updating it', async () => {
  for (const [field, value] of [
    ['name', 'Outro nome'],
    ['clientName', 'Outro cliente'],
    ['clientCnpj', '98765432000199'],
    ['contractCode', 'OUTRO-CONTRATO'],
    ['location', 'Outro local']
  ]) {
    await assert.rejects(
      receiveProjectIntake(validPayload, {
        project: {
          async findUnique() { return projectFromPayload(validPayload, { [field]: value }); },
          async create() { throw new Error('must not create'); }
        }
      }),
      error => error instanceof ProjectIntakeConflictError && error.code === 'PROJECT_CODE_CONFLICT',
      field
    );
  }
});

test('receiveProjectIntake treats an existing soft-deleted record as a reserved code', async () => {
  await assert.rejects(receiveProjectIntake(validPayload, {
    project: {
      async findUnique() {
        return projectFromPayload(validPayload, { deletedAt: new Date(), name: 'Projeto excluído' });
      },
      async create() { throw new Error('must not create'); }
    }
  }), ProjectIntakeConflictError);
});

test('receiveProjectIntake recovers a concurrent equal project after P2002', async () => {
  const uniqueError = new Error('unique project code');
  uniqueError.code = 'P2002';
  let findCount = 0;
  const result = await receiveProjectIntake(validPayload, {
    project: {
      async findUnique() {
        findCount += 1;
        return findCount === 1 ? null : projectFromPayload();
      },
      async create() { throw uniqueError; }
    }
  });
  assert.equal(result.status, 'already_exists');
});

test('receiveProjectIntake rejects a concurrent divergent project after P2002', async () => {
  const uniqueError = new Error('unique project code');
  uniqueError.code = 'P2002';
  let findCount = 0;
  await assert.rejects(receiveProjectIntake(validPayload, {
    project: {
      async findUnique() {
        findCount += 1;
        return findCount === 1 ? null : projectFromPayload(validPayload, { contractCode: 'OUTRO' });
      },
      async create() { throw uniqueError; }
    }
  }), ProjectIntakeConflictError);
});

test('POST /api/webhooks/projects returns a stable conflict without exposing internals', async t => {
  configureToken(t, 'secret-token');
  stubProjectClient(t, { existing: projectFromPayload(validPayload, { name: 'Outro nome' }) });
  const response = await dispatchApp('POST', '/api/webhooks/projects', validPayload, {
    authorization: 'Bearer secret-token'
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json.code, 'PROJECT_CODE_CONFLICT');
  assert.equal('stack' in response.json, false);
});

test('POST /api/webhooks/projects rejects invalid data before touching the database', async t => {
  configureToken(t, 'secret-token');
  let touchedDatabase = false;
  const originalFindUnique = prisma.project.findUnique;
  prisma.project.findUnique = async () => {
    touchedDatabase = true;
    return null;
  };
  t.after(() => {
    prisma.project.findUnique = originalFindUnique;
  });

  const response = await dispatchApp('POST', '/api/webhooks/projects', {
    ...validPayload,
    clientCnpj: '123456789012345'
  }, { authorization: 'Bearer secret-token' });
  assert.equal(response.statusCode, 400);
  assert.equal(touchedDatabase, false);
});
