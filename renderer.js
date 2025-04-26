console.log("renderer.js carregado!");

if (window.Chart && window.ChartZoom) {
  Chart.register(ChartZoom);
} else {
  console.warn("Chart ou ChartZoom não encontrado no global");
}

const container = document.getElementById('container');
const input = document.getElementById('tickerInput');
const dataList = document.getElementById('assetOptions');
const addButton = document.getElementById('addButton');
const rangeControls = document.getElementById('chartRangeControls');

const alertModal = document.getElementById('alertModal');
const closeModalBtn = document.getElementById('closeModal');
const modalTickerElem = document.getElementById('modalTicker');
const alertValueInput = document.getElementById('alertValue');
const cancelAlertBtn = document.getElementById('cancelAlert');
const saveAlertBtn = document.getElementById('saveAlert');

const chartModal = document.getElementById('chartModal');
const closeChartModal = document.getElementById('closeChartModal');
const chartModalCanvas = document.getElementById('chartModalCanvas');

let favorites = [];
let chartRangeDays = 5;
let thresholds = JSON.parse(localStorage.getItem('thresholds') || '{}');
let alerted = {};
let currentAlertTicker = null;
let modalChart = null;

if (Notification.permission !== 'granted') {
  Notification.requestPermission();
}

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
    opt.value = item.symbol.replace('.SA', '');
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

  const alertBtn = document.createElement('button');
  alertBtn.textContent = '🔔';
  alertBtn.className = 'alert-button';
  alertBtn.title = 'Definir alerta';
  alertBtn.addEventListener('click', () => configureAlert(ticker, price));

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

  card.appendChild(alertBtn);
  card.appendChild(info);
  card.appendChild(removeBtn);
  container.appendChild(card);
  chartCanvas.addEventListener('click', () => showChartModal(ticker, history));
  card.appendChild(chartCanvas);

  const th = thresholds[ticker];
  if (th !== undefined && price >= th && !alerted[ticker]) {
    new Notification(`Alerta: ${ticker}`, {
      body: `Preço atingiu ${formattedPrice} (>= ${th})`
    });
    alerted[ticker] = true;
  }
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

function configureAlert(ticker, currentPrice) {
  currentAlertTicker = ticker;
  modalTickerElem.textContent = ticker;
  alertValueInput.value = thresholds[ticker] ?? currentPrice;
  alertModal.style.display = 'flex';
}

closeModalBtn.addEventListener('click', () => alertModal.style.display = 'none');
cancelAlertBtn.addEventListener('click', () => alertModal.style.display = 'none');

saveAlertBtn.addEventListener('click', () => {
  const num = parseFloat(alertValueInput.value);
  if (!isNaN(num) && currentAlertTicker) {
    thresholds[currentAlertTicker] = num;
    localStorage.setItem('thresholds', JSON.stringify(thresholds));
    alerted[currentAlertTicker] = false;
  }
  alertModal.style.display = 'none';
});

closeChartModal.addEventListener('click', () => {
  chartModal.style.display = 'none';
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
});

/**
 * Abre o modal com o gráfico grande.
 * @param {string} ticker 
 * @param {Array} history  array de { date, open, high, low, close, volume }
 */
function showChartModal(ticker, history) {
  console.log("Abrindo modal de gráfico para", ticker, "com", history.length, "pontos");

  const labels = history.map(h => h.date);
  const dataSet = history.map(h => h.close);

  chartModal.style.display = 'flex';

  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
  chartModalCanvas.style.width = '100%';
  chartModalCanvas.style.height = '300px';

  try {
    modalChart = new Chart(chartModalCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: ticker,
          data: dataSet,
          fill: false,
          borderColor: '#4caf50',
          borderWidth: 2,
          pointRadius: history.length > 30 ? 1 : 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { enabled: true, mode: 'index', intersect: false },
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x',
            },
            pan: {
              enabled: true,
              mode: 'x',
            },
          },
        },
        scales: {
          x: {
            display: true,
            title: { display: true, text: 'Data' },
            ticks: {
              maxTicksLimit: 6,
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
            }
          },
          y: {
            display: true,
            title: { display: true, text: 'Fechamento (BRL)' }
          }
        }
      },
    });
    console.log("Gráfico gerado com sucesso");
  } catch (err) {
    console.error("Erro ao criar Chart:", err);
  }
}

init();
