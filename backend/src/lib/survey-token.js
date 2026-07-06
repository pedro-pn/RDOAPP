import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import env from '../config/env.js';
import { hashToken } from './auth.js';

const ALGORITHM = 'aes-256-gcm';

function secretMaterial() {
  return env.surveyTokenSecret || env.databaseUrl || 'dev-survey-token-secret';
}

function key(material = secretMaterial()) {
  return createHash('sha256').update(material).digest();
}

// Materiais aceitos na descriptografia: o atual + os anteriores (SURVEY_TOKEN_SECRET_PREVIOUS),
// para não perder tokens já gravados quando o segredo é rotacionado. A cifra sempre usa o atual.
function decryptionSecrets() {
  return [
    secretMaterial(),
    ...(Array.isArray(env.previousSurveyTokenSecrets) ? env.previousSurveyTokenSecrets : [])
  ].filter(Boolean);
}

export function createSurveyToken() {
  return randomBytes(32).toString('hex');
}

export function surveyTokenHash(token) {
  return hashToken(token);
}

export function encryptSurveyToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    tokenEncrypted: encrypted.toString('base64'),
    tokenIv: iv.toString('base64'),
    tokenAuthTag: authTag.toString('base64')
  };
}

export function decryptSurveyToken({ tokenEncrypted, tokenIv, tokenAuthTag }) {
  let lastError = null;
  for (const material of decryptionSecrets()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key(material), Buffer.from(tokenIv, 'base64'));
      decipher.setAuthTag(Buffer.from(tokenAuthTag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(tokenEncrypted, 'base64')),
        decipher.final()
      ]);
      return decrypted.toString('utf8');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Token de pesquisa indecifrável.');
}

export function surveyTokenData() {
  const token = createSurveyToken();
  return {
    token,
    tokenHash: surveyTokenHash(token),
    ...encryptSurveyToken(token)
  };
}
