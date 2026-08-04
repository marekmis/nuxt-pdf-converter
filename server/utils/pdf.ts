import { PDFiumLibrary } from '@hyzyla/pdfium'
import sharp from 'sharp'

/**
 * Rasterization happens entirely in memory: serverless filesystems are read-only
 * apart from /tmp, so nothing is ever written to disk.
 */

export interface ConvertOptions {
  mergePages: boolean
  targetWidth: number
  jpgQuality: number
  baseName: string
}

export interface ConvertedFile {
  filename: string
  data: Buffer
}

/** Hard ceilings so a hostile or huge PDF cannot exhaust the function's memory. */
const MAX_PAGES = 50
const MAX_TARGET_WIDTH = 3000
/** Render above the target width, then downsample — keeps hairlines and small text crisp. */
const SUPERSAMPLE = 2
const MAX_RENDER_WIDTH = 4000

let libraryPromise: Promise<PDFiumLibrary> | null = null

/** The WASM module is expensive to instantiate, so reuse it across warm invocations. */
function getLibrary(): Promise<PDFiumLibrary> {
  if (!libraryPromise) {
    libraryPromise = PDFiumLibrary.init().catch((error) => {
      libraryPromise = null
      throw error
    })
  }
  return libraryPromise
}

function jpeg(input: sharp.Sharp, quality: number) {
  return input.jpeg({
    quality,
    chromaSubsampling: '4:4:4',
    mozjpeg: true,
    force: true
  })
}

export async function convertPdfToJpg(pdf: Buffer, options: ConvertOptions): Promise<ConvertedFile[]> {
  const targetWidth = Math.min(Math.max(Math.round(options.targetWidth) || 2000, 100), MAX_TARGET_WIDTH)
  const jpgQuality = Math.min(Math.max(Math.round(options.jpgQuality) || 90, 10), 100)

  const library = await getLibrary()
  const document = await library.loadDocument(new Uint8Array(pdf))

  try {
    const pageCount = document.getPageCount()

    if (pageCount === 0) {
      throw new Error('The PDF contains no pages')
    }
    if (pageCount > MAX_PAGES) {
      throw new Error(`The PDF has ${pageCount} pages, which is above the ${MAX_PAGES}-page limit`)
    }

    const pages: { buffer: Buffer; width: number; height: number }[] = []

    for (let i = 0; i < pageCount; i++) {
      const page = document.getPage(i)
      const { originalWidth } = page.getOriginalSize()

      // Rasterize wider than we need, then let Lanczos do the final resize.
      const renderWidth = Math.min(targetWidth * SUPERSAMPLE, MAX_RENDER_WIDTH)
      const scale = renderWidth / originalWidth

      // REVERSE_BYTE_ORDER is set internally, so the bitmap arrives as RGBA.
      const rendered = await page.render({ scale, render: 'bitmap' })

      const buffer = await jpeg(
        sharp(Buffer.from(rendered.data), {
          raw: { width: rendered.width, height: rendered.height, channels: 4 }
        })
          .flatten({ background: '#ffffff' })
          .resize(targetWidth, null, {
            fit: 'inside',
            withoutEnlargement: false,
            kernel: sharp.kernel.lanczos3
          }),
        jpgQuality
      ).toBuffer()

      const metadata = await sharp(buffer).metadata()
      pages.push({ buffer, width: metadata.width!, height: metadata.height! })
    }

    if (!options.mergePages) {
      return pages.map((page, index) => ({
        filename: `${options.baseName}_page_${index + 1}.jpg`,
        data: page.buffer
      }))
    }

    if (pages.length === 1) {
      return [{ filename: `${options.baseName}.jpg`, data: pages[0].buffer }]
    }

    // Stack every page vertically into a single canvas.
    const width = Math.max(...pages.map((page) => page.width))
    const totalHeight = pages.reduce((sum, page) => sum + page.height, 0)

    let top = 0
    const composites = pages.map((page) => {
      const layer = { input: page.buffer, top, left: 0 }
      top += page.height
      return layer
    })

    const merged = await jpeg(
      sharp({
        create: {
          width,
          height: totalHeight,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      }).composite(composites),
      jpgQuality
    ).toBuffer()

    return [{ filename: `${options.baseName}.jpg`, data: merged }]
  } finally {
    document.destroy()
  }
}
