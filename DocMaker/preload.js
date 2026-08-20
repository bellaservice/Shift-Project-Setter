const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('docmaker', {
  loadCompanyInfo: () => ipcRenderer.invoke('docmaker:load-company-info'),
  previewPdf: (payload) => ipcRenderer.invoke('docmaker:preview-pdf', payload),
  generatePdf: (payload) => ipcRenderer.invoke('docmaker:generate-pdf', payload),
  openDraft: () => ipcRenderer.invoke('docmaker:open-draft'),
  openFile: (filePath) => ipcRenderer.invoke('docmaker:open-file', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('docmaker:show-in-folder', filePath)
});
