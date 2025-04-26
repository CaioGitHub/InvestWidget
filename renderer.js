console.log("renderer.js carregado!");

const container = document.getElementById('container');
const input = document.getElementById('tickerInput');
const dataList = document.getElementById('assetOptions');
const addButton = document.getElementById('addButton');
const rangeControls = document.getElementById('chartRangeControls');

let favorites = [];
let chartRangeDays = 5;

input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      dataList.innerHTML = '';
      return;
    }
    const results = await window.electron.searchAssets(q);
    dataList.innerHTML = '';
    results.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.symbol.replace('.SA','');
      opt.label = item.shortname;
      dataList.appendChild(opt);
    });
});

rangeControls.addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') return;
    chartRangeDays = parseInt(e.target.dataset.days, 10);
    rangeControls.querySelectorAll('button').forEach(b =>
        b.classList.toggle('active', b === e.target)
    );
    updateAll();
});
function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}
function drawMiniChart(canvas, prices) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const step = width / (prices.length - 1);

    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    prices.forEach((p, i) => {
        const x = i * step;
        const y = height - ((p - min) / (max - min)) * height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();
}
function updateUI(data, ticker, history) {
    const price = data.regularMarketPrice;
    const prevClose = data.regularMarketPreviousClose ?? data.regularMarketPreviousClose;
    const changePercent = prevClose
        ? ((price - prevClose) / prevClose) * 100
        : (data.regularMarketChangePercent ?? 0);
    const arrow = changePercent >= 0 ? '▲' : '▼';
    const formattedPrice = formatCurrency(price);
    const formattedChange = `${arrow} ${Math.abs(changePercent).toFixed(2)}%`;

    const card = document.createElement('div');
    card.className = 'card fade-in';

    const info = document.createElement('div');
    info.innerHTML = `
    <strong>${ticker}</strong><br>
    ${formattedPrice}<br>
    <span class="change ${changePercent >= 0 ? 'up' : 'down'}">${formattedChange}</span>
  `;
    const chartCanvas = document.createElement('canvas');
    chartCanvas.width = 120;
    chartCanvas.height = 40;
    chartCanvas.className = 'mini-chart';
    if (history.length > 1) drawMiniChart(chartCanvas, history.map(h => h.close));

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove-button';
    removeBtn.title = 'Remover ticker';
    removeBtn.addEventListener('click', () => {
        card.classList.remove('fade-in');
        card.classList.add('fade-out');
        setTimeout(async () => {
            favorites = favorites.filter(t => t !== ticker);
            await window.electron.saveFavorites(favorites);
            updateAll();
        }, 300);
    });

    card.appendChild(info);
    card.appendChild(chartCanvas);
    card.appendChild(removeBtn);
    container.appendChild(card);
}
async function updateAll() {
    container.innerHTML = '';
    for (const ticker of favorites) {
        try {
            const data = await window.electron.fetchStock(ticker);
            const history = await window.electron.fetchHistory(ticker, chartRangeDays);
            if (!data?.regularMarketPrice || !history.length) continue;
            updateUI(data, ticker, history);
        } catch (e) {
            console.error(`Erro ao buscar ${ticker}:`, e);
        }
    }
}
async function init() {
    if (!window.electron) return;
    favorites = await window.electron.getFavorites();
    const filtered = [];
    for (const t of favorites) {
      if (await isValidTicker(t)) filtered.push(t);
    }
    if (filtered.length !== favorites.length) {
      favorites = filtered;
      await window.electron.saveFavorites(favorites);
    }
  
    updateAll();
    setInterval(updateAll, 60000);
}
  

addButton.addEventListener('click', async () => {
    const newTicker = input.value.toUpperCase().trim();
    if (!newTicker) return;
    if (favorites.includes(newTicker)) {
      alert(`${newTicker} já está nos favoritos.`);
      input.value = '';
      return;
    }
    if (!await isValidTicker(newTicker)) {
      alert(`Ticker inválido ou sem dados: ${newTicker}`);
      return;
    }
    favorites.push(newTicker);
    await window.electron.saveFavorites(favorites);
    updateAll();
    input.value = '';
});

async function fetchStockData(ticker) {
    try {
      const response = await fetch(`https://api.exemplo.com/stock/${ticker}`);
      if (!response.ok) throw new Error('Ticker inválido');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Erro ao buscar dados para ${ticker}:`, error.message);
      return null;
    }
  }
  
  async function addTicker(ticker) {
    const stockData = await fetchStockData(ticker);
    if (stockData) {
      createCard(stockData);
      saveToFavorites(ticker);
    } else {
      alert(`Ticker inválido: ${ticker}`);
    }
  }

  
async function isValidTicker(ticker) {
    try {
      const data = await window.electron.fetchStock(ticker);
      return Boolean(data && data.regularMarketPrice);
    } catch {
      return false;
    }
}

init();
