const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const yahooFinance = require('yahoo-finance2').default;

const favoritesPath = path.join(__dirname, 'favorites.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 200,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

ipcMain.handle('fetch-stock', async (event, ticker) => {
  const fullTicker = ticker.includes('.SA') ? ticker : `${ticker}.SA`;
  return await yahooFinance.quote(fullTicker);
});

ipcMain.handle('get-favorites', async () => {
  return JSON.parse(fs.readFileSync(favoritesPath, 'utf-8'));
});

ipcMain.handle('save-favorites', async (event, newFavorites) => {
  fs.writeFileSync(favoritesPath, JSON.stringify(newFavorites, null, 2));
  return true;
});

ipcMain.handle('fetch-history', async (_, ticker, days = 5) => {
  const full = ticker.includes('.SA') ? ticker : `${ticker}.SA`;
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);

  try {
    return await yahooFinance.historical(full, {
      period1: from.toISOString().split('T')[0],
      period2: to.toISOString().split('T')[0],
      interval: '1d'
    });
  } catch (err) {
    console.warn(`Nenhum histórico para ${full}:`, err.message);
    return [];
  }
});

app.whenReady().then(createWindow);
