const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  fetchStock: (ticker) => ipcRenderer.invoke('fetch-stock', ticker),
  fetchHistory: (ticker, days) => ipcRenderer.invoke('fetch-history', ticker, days),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  saveFavorites: (favorites) => ipcRenderer.invoke('save-favorites', favorites),
});
