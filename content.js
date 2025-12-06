const API_URL = 'https://administration-etrangers-en-france.interieur.gouv.fr/api/sejour/usager/statut/demande_sejour';

(function init() {
    // Avoid double injection
    if (document.getElementById('anef-status-panel')) return;

    createPanel();
    checkStatus();

    // Auto-refresh triggers
    window.addEventListener('focus', checkStatus);
    window.addEventListener('hashchange', checkStatus);
    window.addEventListener('popstate', checkStatus);

    // Polling every 30 seconds to keep it fresh
    setInterval(checkStatus, 30000);
})();

function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'anef-status-panel';
    panel.innerHTML = `
        <div class="anef-header">
            <h3>${chrome.i18n.getMessage('appName')}</h3>
            <button id="anef-minimize">—</button>
        </div>
        <div id="anef-content">
            <div id="anef-loading" class="anef-state">
                <div class="anef-spinner"></div>
                <p>${chrome.i18n.getMessage('loading')}</p>
            </div>
            <div id="anef-error" class="anef-state hidden">
                <p>${chrome.i18n.getMessage('error')}</p>
                <button id="anef-retry">${chrome.i18n.getMessage('retry')}</button>
            </div>
            <div id="anef-login" class="anef-state hidden">
                 <p>${chrome.i18n.getMessage('loginRequired')}</p>
            </div>
            <div id="anef-data" class="anef-state hidden">
                <div class="anef-main-status">
                    <span class="anef-label">${chrome.i18n.getMessage('statusLabel')}</span>
                    <h2 id="anef-status-text">--</h2>
                </div>
                <p><strong>${chrome.i18n.getMessage('dateLabel')}:</strong> <span id="anef-status-date">--</span></p>
                <div id="anef-extra-info"></div>
                <button id="anef-refresh">${chrome.i18n.getMessage('refresh')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // Event listeners
    document.getElementById('anef-minimize').addEventListener('click', toggleMinimize);
    document.getElementById('anef-retry').addEventListener('click', checkStatus);
    document.getElementById('anef-refresh').addEventListener('click', checkStatus);
}

function toggleMinimize() {
    const content = document.getElementById('anef-content');
    const btn = document.getElementById('anef-minimize');
    content.classList.toggle('hidden');
    btn.textContent = content.classList.contains('hidden') ? '+' : '—';
}

async function checkStatus() {
    // If minimized, maybe don't show loading spinner excessively? 
    // But for now, standard behavior is fine.

    // Only show loading if we are not already showing data (to avoid flickering on poll)
    // Actually, let's just do silent update if we already have data?
    // For now, let's keep it simple. If we are polling, we might want a 'silent' flag.
    const isSilent = arguments[0] && arguments[0].type === undefined && arguments[0] !== true;
    // checkStatus is called by event listeners (event obj) or setInterval (undefined).

    // Let's deduce 'silent' if we already have data displayed.
    const hasData = !document.getElementById('anef-data').classList.contains('hidden');
    if (!hasData) {
        showState('anef-loading');
    }

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (response.status === 401 || response.status === 403) {
            showState('anef-login');
            // If we are in login state, maybe we want to poll faster? 
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        renderStatus(data);
        showState('anef-data');

    } catch (error) {
        console.error('ANEF Checker Error:', error);
        if (!hasData) showState('anef-error');
    }
}

function renderStatus(data) {
    const statusTextEl = document.getElementById('anef-status-text');
    const statusDateEl = document.getElementById('anef-status-date');
    const extraInfoEl = document.getElementById('anef-extra-info');

    extraInfoEl.innerHTML = '';

    if (!data) {
        statusTextEl.textContent = chrome.i18n.getMessage('noData');
        return;
    }

    const rawStatus = data.statut || 'Unknown';
    statusTextEl.textContent = formatStatus(rawStatus);

    const dateStr = data._updated || data.date_depot;
    if (dateStr) {
        statusDateEl.textContent = new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    } else {
        statusDateEl.textContent = chrome.i18n.getMessage('unknownDate');
    }

    const fields = [
        { key: 'type_demande_sejour', labelI18n: 'typeLabel' },
        { key: 'numero_demande', labelI18n: 'numLabel' },
        { key: 'formulaire', labelI18n: 'formLabel' },
        { key: 'categorie_juridique', labelI18n: 'catLabel' },
        { key: 'date_depot', labelI18n: 'depositLabel' }
    ];

    fields.forEach(field => {
        if (data[field.key]) {
            const p = document.createElement('p');
            let val = data[field.key];
            if (field.key.includes('date')) {
                val = new Date(val).toLocaleDateString();
            }
            const label = chrome.i18n.getMessage(field.labelI18n);
            p.innerHTML = `<strong>${label}:</strong> ${val}`;
            extraInfoEl.appendChild(p);
        }
    });
}

function formatStatus(status) {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function showState(stateId) {
    const states = ['anef-loading', 'anef-error', 'anef-login', 'anef-data'];
    states.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === stateId) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
}
