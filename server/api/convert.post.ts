import { convertPdfToJpg } from '~/server/utils/pdf'

/** Vercel serverless functions reject request bodies above 4.5 MB. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

function toBaseName(filename: string): string {
  return (
    filename
      .replace(/^.*[\\/]/, '') // drop any path the browser may have sent
      .replace(/\.pdf$/i, '')
      .replace(/[^\w.\-()]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'document'
  )
}

function field(parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string): string | undefined {
  const part = parts?.find((p) => p.name === name && !p.filename)
  return part ? part.data.toString('utf8') : undefined
}

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.filename)

  if (!file?.filename) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  if (!file.filename.toLowerCase().endsWith('.pdf')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file type. Please upload a PDF file.' })
  }

  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `"${file.filename}" is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB upload limit`
    })
  }

  try {
    const converted = await convertPdfToJpg(file.data, {
      mergePages: field(parts, 'mergePages') !== 'false',
      targetWidth: Number(field(parts, 'targetWidth') ?? 2000),
      jpgQuality: Number(field(parts, 'jpgQuality') ?? 90),
      baseName: toBaseName(file.filename)
    })

    return {
      success: true,
      files: converted.map((output) => ({
        filename: output.filename,
        // Serverless has no writable public dir, so the image travels in the response.
        base64: output.data.toString('base64')
      }))
    }
  } catch (error) {
    console.error('Conversion error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Conversion failed'
    })
  }
})
