console.log("renderer.js carregado!");

const container = document.getElementById('container');
const input = document.getElementById('tickerInput');
const addButton = document.getElementById('addButton');

let favorites = [];

// Formata número em moeda BRL
function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Cria e exibe um card com cotação, variação e botão de remoção
function updateUI(data, ticker) {
    const price = data.regularMarketPrice;
    const prevClose = data.regularMarketPreviousClose ?? data.regularMarketPreviousClose;
    const changePercent = prevClose
        ? ((price - prevClose) / prevClose) * 100
        : (data.regularMarketChangePercent ?? 0) * 100;
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
    card.appendChild(removeBtn);
    container.appendChild(card);
}

// Atualiza todas as cotações com base na lista de favoritos
async function updateAll() {
    container.innerHTML = '';
    for (const ticker of favorites) {
        try {
            const data = await window.electron.fetchStock(ticker);
            if (!data || !data.regularMarketPrice) {
                console.warn(`Ignorando ticker sem dados: ${ticker}`);
                continue;
            }
            updateUI(data, ticker);
        } catch (e) {
            console.error(`Erro ao buscar ${ticker}:`, e);
        }
    }
}

// Inicializa o widget
async function init() {
    if (!window.electron) {
        console.error("window.electron não está disponível.");
        return;
    }
    favorites = await window.electron.getFavorites();
    console.log("Favoritos carregados:", favorites);
    updateAll();
}

// Listener do botão "Adicionar" com validação prévia
addButton.addEventListener('click', async () => {
    const newTicker = input.value.toUpperCase().trim();
    if (newTicker && !favorites.includes(newTicker)) {
        try {
            const testData = await window.electron.fetchStock(newTicker);
            if (!testData || !testData.regularMarketPrice) {
                throw new Error('Sem dados válidos');
            }
            favorites.push(newTicker);
            await window.electron.saveFavorites(favorites);
            updateAll();
            input.value = '';
        } catch (e) {
            alert(`Ticker inválido ou sem dados: ${newTicker}`);
            console.warn(`Falha ao adicionar ticker: ${newTicker}`, e);
        }
    }
});

init();
setInterval(updateAll, 60000);

