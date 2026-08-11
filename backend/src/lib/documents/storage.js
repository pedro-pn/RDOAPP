import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

import env from '../../config/env.js';

export function safeDocumentPathPart(value) {
  return String(value ?? '').replace(/[<>:"/\\|?*\n\r]/g, '_').trim();
}

function posixPath(value) {
  return String(value || '').split(path.sep).join('/');
}

function isInside(root, targetPath) {
  const relative = path.relative(root, targetPath);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

export function publicPathForToken(prefix, token) {
  const cleanPrefix = `/${String(prefix || '').replace(/^\/+|\/+$/g, '')}`;
  return `${cleanPrefix}/${encodeURIComponent(String(token || ''))}`;
}

export function publicUrlForPath(pathValue, appUrl = env.appUrl) {
  const baseUrl = String(appUrl || '').replace(/\/+$/, '');
  return baseUrl ? `${baseUrl}${pathValue}` : pathValue;
}

export async function writeManagedDocumentFile({
  rootDir = env.uploadDir,
  folderParts = [],
  token,
  fileName,
  bytes,
  extension = 'pdf'
}) {
  if (!bytes?.length) throw new TypeError('Document bytes are required.');
  const dir = path.join(rootDir, ...folderParts.map(safeDocumentPathPart).filter(Boolean));
  await fs.mkdir(dir, { recursive: true });
  const baseName = safeDocumentPathPart(path.basename(fileName || 'anexo', path.extname(fileName || ''))) || 'anexo';
  const safeExtension = safeDocumentPathPart(extension || 'bin').replace(/^\.+/, '') || 'bin';
  const targetName = `${baseName}-${safeDocumentPathPart(token) || Date.now()}.${safeExtension}`;
  const targetPath = path.join(dir, targetName);
  await fs.writeFile(targetPath, bytes, { flag: 'wx' });
  return posixPath(path.relative(rootDir, targetPath));
}

export function resolveManagedDocumentPath(storagePath, {
  rootDir = env.uploadDir,
  requiredPrefix = ''
} = {}) {
  const rawPath = posixPath(storagePath);
  if (!rawPath || rawPath.startsWith('/') || rawPath.split('/').includes('..')) return null;
  const normalizedPath = rawPath.replace(/^\/+/, '');
  if (!normalizedPath) return null;
  if (requiredPrefix && !normalizedPath.startsWith(requiredPrefix)) return null;

  const root = path.resolve(rootDir);
  const targetPath = path.resolve(root, ...normalizedPath.split('/'));
  if (!isInside(root, targetPath)) return null;
  if (!fsSync.existsSync(targetPath) || !fsSync.statSync(targetPath).isFile()) return null;
  return targetPath;
}

export async function unlinkManagedDocumentFile(storagePath, {
  rootDir = env.uploadDir,
  requiredPrefix = ''
} = {}) {
  const targetPath = resolveManagedDocumentPath(storagePath, { rootDir, requiredPrefix });
  if (!targetPath) return false;
  await fs.unlink(targetPath).catch(() => {});
  return true;
}

/**
 * Nome de arquivo em ASCII puro, para o par\u00e2metro `filename` antigo.
 *
 * Ele existe junto com o `filename*` porque nem todo cliente entende o segundo \u2014
 * e "Proposta T\u00e9cnica.pdf" tem acento. Sem a vers\u00e3o dobrada, o nome chega
 * quebrado ou o cabe\u00e7alho inteiro \u00e9 descartado.
 */
function nomeEmAscii(fileName) {
  return String(fileName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ._\-]/g, '_');
}

export function inlineContentDisposition(fileName) {
  return `inline; filename="${nomeEmAscii(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** For\u00e7a o download em vez de abrir no navegador. */
export function attachmentContentDisposition(fileName) {
  return `attachment; filename="${nomeEmAscii(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
