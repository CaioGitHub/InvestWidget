const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  fetchStock: (ticker) => ipcRenderer.invoke('fetch-stock', ticker),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  saveFavorites: (favorites) => ipcRenderer.invoke('save-favorites', favorites),
});
