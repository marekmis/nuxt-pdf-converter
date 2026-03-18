# PDF to JPG Converter

A Nuxt 3 web app that converts PDF files to high-quality JPG images. Each page is rasterized using [pdf-poppler](https://github.com/shgysk8zer0/pdf-poppler) (Poppler's `pdftoppm`) and post-processed with [Sharp](https://sharp.pixelplumbing.com/).

## Features

- **Drag & drop or click-to-browse** file upload — supports multiple PDFs at once (max 50 MB each)
- **Two output modes**
  - *Merge into one file* — all pages stitched vertically into a single JPG
  - *Individual files* — each page saved as a separate JPG
- **Configurable quality** — set target width (px) and JPG quality (%) before converting
- High-fidelity rendering using Lanczos3 resampling and MozJPEG compression
- Uploaded PDFs are automatically deleted after conversion

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Nuxt 3 + Nuxt UI |
| PDF rasterization | pdf-poppler (`pdftoppm.exe`) |
| Image processing | Sharp |

## Local Development

**Prerequisites:** Node.js 18+, npm

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.
