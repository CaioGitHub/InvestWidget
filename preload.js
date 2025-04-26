const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  fetchStock: ticker => ipcRenderer.invoke('fetch-stock', ticker),
  fetchHistory: (ticker, days) => ipcRenderer.invoke('fetch-history', ticker, days),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  saveFavorites: favs => ipcRenderer.invoke('save-favorites', favs),
  searchAssets:  query => ipcRenderer.invoke('search-assets', query),
});
