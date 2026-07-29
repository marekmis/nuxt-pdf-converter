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

## Desktop App (Windows)

The app can be packaged as a standalone Windows desktop app. **End users need nothing
preinstalled** — no Node.js, no npm, no build tools. Electron bundles its own Node
runtime, Sharp ships prebuilt Node-API binaries, and Poppler is a plain set of exes
and DLLs, so nothing is compiled at install time.

Build the installer:

```bash
npm run dist
```

This produces `release/PDF to JPG Converter Setup <version>.exe` (~120 MB), a per-user
NSIS installer that needs no admin rights. `npm run dist:dir` skips the installer and
just produces a runnable `release/win-unpacked/` folder.

To run the desktop shell against a local build without packaging:

```bash
npm run desktop
```

### How it works

`electron/main.cjs` starts the built Nitro server as a child process on a free
localhost port (using `ELECTRON_RUN_AS_NODE`, so it runs under a plain Node
environment rather than Electron's module loader), waits for it to accept
connections, then opens a `BrowserWindow` pointed at it. Closing the window shuts
the server down. Set `PDFC_PORT` to pin the port when debugging.

Two env vars bridge Electron and the server, both read in
[`server/utils/paths.ts`](server/utils/paths.ts):

| Variable | Purpose |
|---|---|
| `PDFC_RESOURCES_DIR` | Electron's `resourcesPath` — where the bundled Poppler binaries live |
| `PDFC_DATA_DIR` | Per-user writable dir for uploads and converted output |

Neither is set in development, so everything falls back to the repo directory
(`.data/` for uploads and outputs).

Because the install location is read-only, converted images are written to the
per-user data dir rather than `public/outputs`, and served by
[`server/routes/outputs/[...path].get.ts`](server/routes/outputs/[...path].get.ts).

### Where converted files go

In the desktop app, each JPG is saved **into the same folder as the PDF it came
from**, automatically, as soon as conversion finishes — no download step. The
results list then offers *Show in folder* for each file.

This needs the source PDF's real path, which Electron only exposes via
`webUtils.getPathForFile` in a preload script (`File.path` was removed in Electron
32). [`electron/preload.cjs`](electron/preload.cjs) exposes that, plus the save and
reveal calls, over `contextBridge`.

Behaviour details:

- **Existing files are never overwritten.** A second conversion of `report.pdf`
  produces `report (1).jpg`, not a replaced `report.jpg`.
- **Files are moved, not copied** — the working copy in the app's data dir is
  removed once it is safely in place, so `%APPDATA%` doesn't grow over time.
- **If automatic saving fails** — read-only source folder, a PDF opened from a
  location with no real path — that file stays listed with a *Save as…* button that
  opens a native save dialog (a folder picker when several files are pending).
- **In a plain browser** (`npm run dev`) `window.pdfcDesktop` is absent, so the page
  falls back to ordinary download links and behaves exactly as before.

### Packaging notes

- Only the Electron shell goes into `app.asar` (~8 KB). Every runtime dependency the
  server needs is already traced into `.output/server/node_modules` by Nitro.
- `npmRebuild: false` is required: nothing shipped needs compiling, and without it
  electron-builder runs `node-gyp` over Nuxt's transitive native dev dependencies and
  fails on machines without Visual Studio.
- `signAndEditExecutable: false` skips electron-builder's code-signing toolchain. See
  the comment in [`electron-builder.yml`](electron-builder.yml) for the trade-off (default
  Electron icon, no embedded version metadata) and how to re-enable it.
- The build is Windows-only, because `pdf-poppler` bundles Poppler binaries for Windows
  and macOS only, and the Poppler path is resolved for Windows.
- Unsigned installers trigger a Windows SmartScreen "unknown publisher" warning.
