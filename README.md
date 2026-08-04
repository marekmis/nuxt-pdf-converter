# PDF to JPG Converter

A Nuxt 3 web app that converts PDF files to high-quality JPG images. Pages are rasterized with [PDFium](https://github.com/hyzyla/pdfium) compiled to WebAssembly and post-processed with [Sharp](https://sharp.pixelplumbing.com/). The whole app sits behind a single shared password enforced on the server.

## Features

- **Password protected** — server-side gate on every page and API route, backed by one env var
- **Drag & drop or click-to-browse** file upload — supports multiple PDFs at once
- **Two output modes**
  - *Merge into one file* — all pages stitched vertically into a single JPG
  - *Individual files* — each page saved as a separate JPG
- **Configurable quality** — set target width (px) and JPG quality (%) before converting
- High-fidelity rendering: 2× supersampled rasterization, Lanczos3 downsampling, MozJPEG compression
- **Stateless** — nothing is written to disk; PDFs are converted in memory and the JPGs are returned in the response

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Nuxt 3 + Nuxt UI |
| PDF rasterization | `@hyzyla/pdfium` (WASM — no native binaries, runs anywhere) |
| Image processing | Sharp |
| Auth | `h3` sealed session cookie |

## Authentication

Set a single environment variable:

```
APP_PASSWORD=your-password-here
```

- Every route is gated by [`server/middleware/auth.ts`](server/middleware/auth.ts), which runs before any page render or API handler. Page requests redirect to `/login`; API requests get `401`.
- `POST /api/auth/login` compares the submitted password in constant time and, on success, issues an HttpOnly, `SameSite=Lax`, `Secure` (in production) sealed session cookie valid for 12 hours.
- The cookie's signing key is derived from `APP_PASSWORD` (SHA-256), so **changing the password immediately invalidates every existing session**.
- If `APP_PASSWORD` is unset the app **fails closed** — routes return `503` rather than becoming public.

`NUXT_APP_PASSWORD` works too, since the value is read through `runtimeConfig.appPassword`.

Note this is a single shared password, not per-user accounts, and there is no distributed rate limiting — failed logins just get a fixed 500 ms delay. That's appropriate for gating an internal tool, not for protecting sensitive data.

## Local Development

**Prerequisites:** Node.js 18+, npm

```bash
npm install
```

Create a `.env` file (see [`.env.example`](.env.example)):

```
APP_PASSWORD=dev
```

Then:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel. The Nuxt preset is detected automatically — no `vercel.json` needed.
2. Add `APP_PASSWORD` under **Settings → Environment Variables** (Production, Preview, and Development).
3. Deploy.

The serverless function is configured in [`nuxt.config.ts`](nuxt.config.ts) with `maxDuration: 60` and `memory: 3009` to give the rasterizer room. `maxDuration: 60` requires Hobby or above; Pro allows up to 300.

> Let Vercel run the build (git import, or `vercel deploy` without `--prebuilt`). A `--prebuilt` deploy from a Windows machine would ship the Windows build of Sharp instead of the Linux one.

### Platform limits to be aware of

Vercel serverless functions cap both request and response bodies at **4.5 MB**:

- **Uploads** are limited to 4 MB per PDF, enforced in the UI and again in [`server/api/convert.post.ts`](server/api/convert.post.ts).
- **Responses** carry the JPGs inline as base64, which adds ~33% overhead. A large merged image can exceed the cap — reduce *target width* or *JPG quality* if a conversion fails on a big multi-page document.
- Documents over 50 pages are rejected, and target width is clamped to 3000 px.

To lift these limits the files would have to leave the request/response path — e.g. upload straight to [Vercel Blob](https://vercel.com/docs/vercel-blob) from the browser and have the function read and write there instead.
