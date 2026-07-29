import path from 'path';
import fs from 'fs';

/**
 * Path resolution that works both in `nuxt dev` and inside the packaged
 * Electron app.
 *
 * When packaged, the Electron main process sets these env vars before
 * spawning the Nitro server:
 *   PDFC_RESOURCES_DIR - Electron's process.resourcesPath (read-only)
 *   PDFC_DATA_DIR      - a writable per-user dir (app.getPath('userData'))
 *
 * In dev neither is set, so everything resolves relative to the repo root.
 */

const resourcesDir = process.env.PDFC_RESOURCES_DIR;
const dataDir = process.env.PDFC_DATA_DIR ?? path.join(process.cwd(), '.data');

export const isPackaged = Boolean(resourcesDir);

/** Folder holding pdftoppm.exe and its DLLs. */
export const popplerBinDir = resourcesDir
  ? path.join(resourcesDir, 'poppler', 'bin')
  : path.join(process.cwd(), 'node_modules', 'pdf-poppler', 'lib', 'win', 'poppler-0.51', 'bin');

export const pdftoppmPath = path.join(popplerBinDir, 'pdftoppm.exe');

/** Writable dirs. Never inside the install location. */
export const uploadsDir = path.join(dataDir, 'uploads');
export const outputsDir = path.join(dataDir, 'outputs');

export function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
