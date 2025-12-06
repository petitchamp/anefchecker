const API_URL = 'https://administration-etrangers-en-france.interieur.gouv.fr/api/sejour/usager/statut/demande_sejour';

document.addEventListener('DOMContentLoaded', () => {
    localizeHtml();
    checkStatus();

    document.getElementById('retry-btn').addEventListener('click', checkStatus);
    document.getElementById('refresh-btn').addEventListener('click', checkStatus);
});

function localizeHtml() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.textContent = message;
        }
    });
}

function getMessage(key) {
    return chrome.i18n.getMessage(key) || key;
}

async function checkStatus() {
    showState('loading');

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            credentials: 'include', // Important to send cookies
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (response.status === 401 || response.status === 403) {
            showState('login-required');
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        renderStatus(data);
        showState('status-display');

    } catch (error) {
        console.error('Fetch error:', error);
        document.getElementById('error-message').textContent = getMessage('error');
        showState('error');
    }
}

function renderStatus(data) {
    const statusTextEl = document.getElementById('status-text');
    const statusDateEl = document.getElementById('status-date');
    const extraInfoEl = document.getElementById('extra-info');

    // Clear previous extra info
    extraInfoEl.innerHTML = '';

    if (!data) {
        statusTextEl.textContent = getMessage('noData');
        return;
    }

    // 1. Status
    const rawStatus = data.statut || 'Unknown';
    statusTextEl.textContent = formatStatus(rawStatus);

    // 2. Date
    const dateStr = data._updated || data.date_depot;
    if (dateStr) {
        statusDateEl.textContent = new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    } else {
        statusDateEl.textContent = getMessage('unknownDate');
    }

    // 3. Extra Details
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
            const label = getMessage(field.labelI18n);
            p.innerHTML = `<strong>${label}:</strong> ${val}`;
            extraInfoEl.appendChild(p);
        }
    });

    // Fallback for unknown fields
    const shownKeys = fields.map(f => f.key).concat(['statut', '_updated']);
    for (const [key, value] of Object.entries(data)) {
        if (shownKeys.includes(key)) continue;
        if (typeof value === 'object') continue;

        const p = document.createElement('p');
        p.innerHTML = `<strong>${formatKey(key)}:</strong> ${value}`;
        extraInfoEl.appendChild(p);
    }
}

function formatStatus(status) {
    // "TITRE_FABRIQUE" -> "Titre Fabrique"
    // We could localize status strings too if we knew all of them, but formatting is a good start.
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatKey(key) {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function showState(stateId) {
    const states = ['loading', 'error', 'login-required', 'status-display'];
    states.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === stateId) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}
