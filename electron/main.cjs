const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

// Single instance — a second launch focuses the existing window instead of
// starting a second Nitro server.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let serverProcess = null;
let mainWindow = null;

/** Where the built Nitro server and the poppler binaries live. */
function resolvePaths() {
  if (app.isPackaged) {
    return {
      resourcesDir: process.resourcesPath,
      serverEntry: path.join(process.resourcesPath, 'app-server', 'server', 'index.mjs')
    };
  }
  // Unpackaged: run against .output in the repo.
  const repoRoot = path.join(__dirname, '..');
  return {
    resourcesDir: '',
    serverEntry: path.join(repoRoot, '.output', 'server', 'index.mjs')
  };
}

function findFreePort() {
  // PDFC_PORT pins the port instead of picking a free one — useful for
  // debugging or driving the packaged app from outside.
  if (process.env.PDFC_PORT) {
    return Promise.resolve(Number(process.env.PDFC_PORT));
  }

  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Server did not start within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 200);
        }
      });
    };
    attempt();
  });
}

async function startServer() {
  const { resourcesDir, serverEntry } = resolvePaths();

  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Server bundle not found at ${serverEntry}.` +
        (app.isPackaged ? '' : ' Run `npm run build` first.')
    );
  }

  const port = await findFreePort();

  // ELECTRON_RUN_AS_NODE makes process.execPath behave as a plain Node
  // binary, so the Nitro server runs in a normal Node environment rather
  // than under Electron's module loader.
  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      NITRO_PORT: String(port),
      PORT: String(port),
      HOST: '127.0.0.1',
      NITRO_HOST: '127.0.0.1',
      PDFC_RESOURCES_DIR: resourcesDir,
      PDFC_DATA_DIR: app.getPath('userData')
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  serverProcess.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (code !== 0 && !app.isQuitting) {
      dialog.showErrorBox('PDF Converter', `The conversion service stopped unexpectedly (code ${code}).`);
      app.quit();
    }
  });

  await waitForServer(port);
  return port;
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 900,
    show: false,
    backgroundColor: '#111827',
    title: 'PDF to JPG Converter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // webUtils.getPathForFile in the preload needs the unsandboxed bridge.
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Anything that isn't the local app opens in the real browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${port}`)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

// ---------------------------------------------------------------------------
// Saving converted files
//
// The server writes output into <userData>/outputs. These handlers move those
// files to wherever the user actually wants them, so the UI never has to fall
// back to a browser-style download.
// ---------------------------------------------------------------------------

/** Resolve a filename inside the outputs dir, rejecting anything that escapes it. */
function resolveOutputFile(filename) {
  const outputsDir = path.join(app.getPath('userData'), 'outputs');
  const resolved = path.resolve(outputsDir, path.basename(String(filename)));
  if (resolved !== path.join(outputsDir, path.basename(String(filename)))) {
    throw new Error('Invalid output filename');
  }
  return resolved;
}

/** Never clobber an existing file — fall back to "name (1).jpg". */
function uniqueTarget(dir, filename) {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  let n = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

/**
 * Move one converted file into targetDir. Copy-then-unlink rather than rename,
 * because the destination is frequently on a different volume than AppData.
 */
function moveOutput(filename, targetDir) {
  const source = resolveOutputFile(filename);
  if (!fs.existsSync(source)) {
    throw new Error('Converted file is no longer available');
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const target = uniqueTarget(targetDir, path.basename(filename));
  fs.copyFileSync(source, target);
  fs.unlinkSync(source);
  return target;
}

/** items: [{ filename, targetDir }] */
ipcMain.handle('pdfc:save-outputs', async (_event, items) => {
  const saved = [];
  const failed = [];

  for (const item of Array.isArray(items) ? items : []) {
    try {
      if (!item || !item.targetDir) throw new Error('No destination folder for this file');
      saved.push({ filename: path.basename(item.filename), path: moveOutput(item.filename, item.targetDir) });
    } catch (err) {
      failed.push({ filename: item && item.filename, error: err.message });
    }
  }

  return { saved, failed };
});

/** items: [{ filename }] — prompts for a destination, then moves everything there. */
ipcMain.handle('pdfc:save-outputs-as', async (_event, items) => {
  const list = (Array.isArray(items) ? items : []).filter((i) => i && i.filename);
  if (list.length === 0) return { saved: [], failed: [], canceled: true };

  // One file gets a Save As dialog; several get a folder picker.
  if (list.length === 1) {
    const name = path.basename(list[0].filename);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save converted image',
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: 'JPEG image', extensions: ['jpg', 'jpeg'] }]
    });
    if (result.canceled || !result.filePath) return { saved: [], failed: [], canceled: true };

    try {
      const source = resolveOutputFile(list[0].filename);
      fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
      fs.copyFileSync(source, result.filePath);
      fs.unlinkSync(source);
      return { saved: [{ filename: name, path: result.filePath }], failed: [], canceled: false };
    } catch (err) {
      return { saved: [], failed: [{ filename: name, error: err.message }], canceled: false };
    }
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder for the converted images',
    defaultPath: app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths.length) return { saved: [], failed: [], canceled: true };

  const targetDir = result.filePaths[0];
  const saved = [];
  const failed = [];
  for (const item of list) {
    try {
      saved.push({ filename: path.basename(item.filename), path: moveOutput(item.filename, targetDir) });
    } catch (err) {
      failed.push({ filename: item.filename, error: err.message });
    }
  }
  return { saved, failed, canceled: false };
});

ipcMain.handle('pdfc:show-in-folder', async (_event, filePath) => {
  if (typeof filePath === 'string' && filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    const port = await startServer();
    createWindow(port);
  } catch (err) {
    dialog.showErrorBox('PDF Converter — startup failed', String(err && err.stack ? err.stack : err));
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
