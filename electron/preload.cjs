const { contextBridge, ipcRenderer, webUtils } = require('electron');

/**
 * Narrow bridge for the renderer. The web UI runs unchanged in a plain
 * browser (npm run dev), where window.pdfcDesktop is simply absent and the
 * page falls back to ordinary download links.
 */
contextBridge.exposeInMainWorld('pdfcDesktop', {
  isDesktop: true,

  /**
   * Real filesystem path of a File the user picked or dropped, so output can
   * be written next to the source PDF. Returns null if unavailable.
   */
  getPathForFile(file) {
    try {
      const p = webUtils.getPathForFile(file);
      return p || null;
    } catch {
      return null;
    }
  },

  /** Move converted files out of the app's data dir into targetDir. */
  saveOutputs(items) {
    return ipcRenderer.invoke('pdfc:save-outputs', items);
  },

  /** Same, but ask the user where to put them first. */
  saveOutputsAs(items) {
    return ipcRenderer.invoke('pdfc:save-outputs-as', items);
  },

  /** Reveal a saved file in File Explorer. */
  showInFolder(filePath) {
    return ipcRenderer.invoke('pdfc:show-in-folder', filePath);
  }
});
