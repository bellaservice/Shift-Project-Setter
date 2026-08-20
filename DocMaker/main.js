const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { buildDocumentHtml } = require('./lib/pdf-template');

let mainWindow;
let previewWindow; // reused hidden window, for the live preview only

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 860,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true // required for the embedded PDF viewer used by the live preview
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    if (previewWindow && !previewWindow.isDestroyed()) previewWindow.destroy();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function renderPdfInWindow(win, payload) {
  const html = buildDocumentHtml(payload);
  const tempHtmlPath = path.join(os.tmpdir(), `docmaker-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  await fs.writeFile(tempHtmlPath, html, 'utf-8');
  try {
    await win.loadFile(tempHtmlPath);
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'none' }
    });
  } finally {
    await fs.unlink(tempHtmlPath).catch(() => {});
  }
}

function getPreviewWindow() {
  if (!previewWindow || previewWindow.isDestroyed()) {
    previewWindow = new BrowserWindow({ show: false });
  }
  return previewWindow;
}

// Live-preview renders share one reused hidden window and must be
// serialized, since two loadFile() calls can't safely race on it.
let previewQueue = Promise.resolve();
function renderPreviewPdf(payload) {
  const task = previewQueue.then(() => renderPdfInWindow(getPreviewWindow(), payload));
  // keep the queue alive even if this render fails, so later ones still run
  previewQueue = task.then(() => {}, () => {});
  return task;
}

// The final "Generera Document" export gets its own throwaway window,
// deliberately NOT sharing the preview queue — otherwise a click made while
// the user is still typing has to wait behind a backlog of pending preview
// renders, leaving the button stuck disabled far longer than expected.
async function renderFinalPdf(payload) {
  const win = new BrowserWindow({ show: false });
  try {
    return await renderPdfInWindow(win, payload);
  } finally {
    win.destroy();
  }
}

ipcMain.handle('docmaker:load-company-info', async () => {
  const raw = await fs.readFile(path.join(__dirname, 'config', 'company.json'), 'utf-8');
  return JSON.parse(raw);
});

ipcMain.handle('docmaker:preview-pdf', async (event, payload) => {
  const pdfBuffer = await renderPreviewPdf(payload);
  return pdfBuffer.toString('base64');
});

ipcMain.handle('docmaker:generate-pdf', async (event, payload) => {
  const defaultName = `${payload.suggestedFileName || 'Arbetsdagbok'}.pdf`;

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Spara dokument',
    defaultPath: defaultName,
    filters: [{ name: 'PDF-dokument', extensions: ['pdf'] }]
  });

  if (canceled || !filePath) {
    return { cancelled: true };
  }

  const pdfBuffer = await renderFinalPdf(payload);
  await fs.writeFile(filePath, pdfBuffer);

  // Save an editable sidecar draft next to the PDF so this document's data
  // can be reopened later and continued via "Öppna utkast".
  const draftPath = filePath.replace(/\.pdf$/i, '') + '.json';
  await fs.writeFile(
    draftPath,
    JSON.stringify({ days: payload.days, cover: payload.cover }, null, 2),
    'utf-8'
  ).catch(() => {});

  return { cancelled: false, filePath, draftPath };
});

ipcMain.handle('docmaker:open-draft', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Öppna utkast',
    filters: [{ name: 'DocMaker-utkast', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (canceled || !filePaths.length) {
    return { cancelled: true };
  }

  try {
    const raw = await fs.readFile(filePaths[0], 'utf-8');
    const data = JSON.parse(raw);
    return { cancelled: false, days: data.days || [], cover: data.cover || {} };
  } catch (err) {
    return { cancelled: false, error: 'Kunde inte läsa filen. Är den ett giltigt DocMaker-utkast?' };
  }
});

ipcMain.handle('docmaker:open-file', async (event, filePath) => {
  await shell.openPath(filePath);
});

ipcMain.handle('docmaker:show-in-folder', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});
