import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const streamPipeline = promisify(pipeline);

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed'
    });
  }

  try {
    const files = await readMultipartFormData(event);
    
    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No file uploaded'
      });
    }

    const file = files[0];
    
    if (!file.filename || !file.filename.toLowerCase().endsWith('.pdf')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid file type. Please upload a PDF file.'
      });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.filename}`;
    const filepath = path.join(uploadsDir, filename);

    // Save the file
    fs.writeFileSync(filepath, file.data);

    console.log(`File uploaded: ${filename}`);

    return {
      success: true,
      filename: filename,
      originalName: file.filename,
      message: 'File uploaded successfully'
    };

  } catch (error) {
    console.error('Upload error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});