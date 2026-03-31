import path from 'path';
import fs from 'fs';
import { convertPdfToJpg } from '~/server/utils/converter';

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed'
    });
  }

  try {
    const body = await readBody(event);
    const { filename, originalName, mergePages = true, targetWidth = 2000, jpgQuality = 90 } = body;

    // Derive the clean output base name: use originalName if provided,
    // otherwise strip the timestamp prefix (e.g. "1234567890_foo.pdf" → "foo")
    const rawBaseName = originalName
      ? path.basename(originalName, '.pdf')
      : path.basename(filename, '.pdf').replace(/^\d+_/, '');
    const cleanBaseName = rawBaseName.replace(/\s+/g, '-');

    if (!filename) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Filename is required'
      });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const outputsDir = path.join(process.cwd(), 'public', 'outputs');
    const inputPath = path.join(uploadsDir, filename);

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found'
      });
    }

    // Create outputs directory if it doesn't exist
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    console.log(`Starting conversion for: ${filename} (merge: ${mergePages})`);

    // Convert PDF to JPG
    const result = await convertPdfToJpg(inputPath, outputsDir, mergePages, targetWidth, jpgQuality, cleanBaseName);

    console.log(`Conversion completed:`, result);

    // Clean up uploaded PDF file
    fs.unlinkSync(inputPath);

    if (Array.isArray(result)) {
      // Individual files mode
      return {
        success: true,
        files: result.map(f => ({
          filename: f,
          downloadUrl: `/outputs/${f}`
        })),
        message: 'Conversion completed successfully'
      };
    }

    // Merged mode
    return {
      success: true,
      outputFilename: result,
      downloadUrl: `/outputs/${result}`,
      message: 'Conversion completed successfully'
    };

  } catch (error) {
    console.error('Conversion error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Conversion failed'
    });
  }
});