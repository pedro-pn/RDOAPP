import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import env from '../../config/env.js';
import {
  publicPathForToken,
  publicUrlForPath,
  safeDocumentPathPart,
  writeManagedDocumentFile
} from '../documents/storage.js';
import prisma from '../prisma.js';

const PUBLIC_PATH_PREFIX = '/api/estoque-anexos';
const STOCK_FOLDER = 'Estoque';
const FISPQ_FOLDER = 'FISPQ';
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function fispqDir() {
  return path.join(env.uploadDir, safeDocumentPathPart(STOCK_FOLDER), safeDocumentPathPart(FISPQ_FOLDER));
}

function parsePdfUpload(upload) {
  if (!upload) return null;
  const fileName = String(upload.fileName || upload.name || '').trim();
  const dataUrl = String(upload.dataUrl || '').trim();
  if (!fileName || !dataUrl) return null;
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    const error = new Error('A FISPQ deve ser enviada em PDF.');
    error.statusCode = 400;
    throw error;
  }
  const match = dataUrl.match(/^data:application\/pdf;base64,(.+)$/i);
  if (!match) {
    const error = new Error('A FISPQ deve ser enviada em formato PDF.');
    error.statusCode = 400;
    throw error;
  }
  const bytes = Buffer.from(match[1], 'base64');
  if (!bytes.length || bytes.length > MAX_PDF_BYTES || bytes.subarray(0, 4).toString('utf8') !== '%PDF') {
    const error = new Error('Arquivo PDF inválido.');
    error.statusCode = 400;
    throw error;
  }
  return { fileName, bytes };
}

async function findStockAttachmentPath(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return null;
  const dir = fispqDir();
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const match = entries.find(entry => entry.isFile() && entry.name.endsWith(`-${cleanToken}.pdf`));
  return match ? path.join(dir, match.name) : null;
}

export function publicStockAttachmentUrl(token) {
  return publicUrlForPath(publicPathForToken(PUBLIC_PATH_PREFIX, token));
}

export async function createStockFispqAttachment({ upload }) {
  const parsed = parsePdfUpload(upload);
  if (!parsed) return null;
  const token = randomUUID();
  await writeManagedDocumentFile({
    rootDir: env.uploadDir,
    folderParts: [STOCK_FOLDER, FISPQ_FOLDER],
    token,
    fileName: parsed.fileName,
    bytes: parsed.bytes
  });
  return token;
}

export async function removeStockFispqAttachment(token) {
  const targetPath = await findStockAttachmentPath(token);
  if (!targetPath) return false;
  await fs.unlink(targetPath).catch(() => {});
  return true;
}

export async function resolvePublicStockAttachment(token, client = prisma) {
  const item = await client.stockItem.findFirst({
    where: { fispqToken: token },
    select: { id: true, code: true, name: true, fispqToken: true }
  });
  if (!item?.fispqToken) return null;
  const targetPath = await findStockAttachmentPath(item.fispqToken);
  if (!targetPath) return null;
  return { item, token: item.fispqToken, targetPath };
}

export function stockAttachmentFileName(resolved) {
  const item = resolved?.item || {};
  const label = [item.code, item.name].filter(Boolean).join(' - ') || 'FISPQ';
  return `${label}.pdf`;
}
