import fs from 'fs';
import path from 'path';
import { outputsDir } from '~/server/utils/paths';

/**
 * Serves converted images from the writable data dir.
 *
 * Outputs used to live in public/outputs and be served as static assets, but
 * in the packaged app the install location is read-only, so they now live
 * under the per-user data dir. This keeps the /outputs/<name> URLs unchanged.
 */
export default defineEventHandler(async (event) => {
  const requested = getRouterParam(event, 'path') ?? '';

  // Only ever serve a plain filename out of outputsDir — no traversal.
  const filename = path.basename(decodeURIComponent(requested));
  const filePath = path.join(outputsDir, filename);

  if (!filename || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' });
  }

  setHeader(event, 'Content-Type', 'image/jpeg');
  setHeader(event, 'Content-Disposition', `inline; filename="${filename}"`);
  setHeader(event, 'Cache-Control', 'no-store');

  return sendStream(event, fs.createReadStream(filePath));
});
