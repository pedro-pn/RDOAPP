import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSurveyToken,
  decryptSurveyToken,
  encryptSurveyToken,
  surveyTokenData,
  surveyTokenHash
} from '../src/lib/survey-token.js';
import { hashToken } from '../src/lib/auth.js';
import env from '../src/config/env.js';

test('survey tokens are encrypted and decrypted without storing the raw token', () => {
  const token = createSurveyToken();
  const encrypted = encryptSurveyToken(token);

  assert.equal(typeof token, 'string');
  assert.equal(token.length, 64);
  assert.notEqual(encrypted.tokenEncrypted, token);
  assert.equal(decryptSurveyToken(encrypted), token);
});

test('surveyTokenData returns token hash and encrypted payload', () => {
  const data = surveyTokenData();

  assert.equal(data.tokenHash, hashToken(data.token));
  assert.equal(surveyTokenHash(data.token), data.tokenHash);
  assert.equal(decryptSurveyToken(data), data.token);
});

test('survey token decryption supports previous survey secrets during rotation', () => {
  const previousEnv = {
    surveyTokenSecret: env.surveyTokenSecret,
    previousSurveyTokenSecrets: env.previousSurveyTokenSecrets
  };
  try {
    env.surveyTokenSecret = 'old-survey-token-secret';
    env.previousSurveyTokenSecrets = [];
    const encrypted = encryptSurveyToken('rotating-survey-token');

    env.surveyTokenSecret = 'new-survey-token-secret';
    env.previousSurveyTokenSecrets = ['old-survey-token-secret'];

    assert.equal(decryptSurveyToken(encrypted), 'rotating-survey-token');
  } finally {
    env.surveyTokenSecret = previousEnv.surveyTokenSecret;
    env.previousSurveyTokenSecrets = previousEnv.previousSurveyTokenSecrets;
  }
});
