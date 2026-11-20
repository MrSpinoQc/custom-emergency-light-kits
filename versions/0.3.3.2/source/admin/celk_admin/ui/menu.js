'use strict';
const byId = id => document.getElementById(id);
const panel = byId('panel');
const status = byId('status');
let current, timer;

function post(action, payload = {}) {
    return fetch('https://' + GetParentResourceName() + '/' + action, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(payload),
    });
}

function pending(operation) {
    byId('save').disabled = byId('refresh').disabled = true;
    status.textContent = 'Demande en cours…';
    clearTimeout(timer);
    timer = setTimeout(() => {
        byId('save').disabled = byId('refresh').disabled = false;
        status.textContent = 'Réponse indisponible. Actualise pour reprendre.';
    }, 5000);
    operation.then(async response => {
        if (!response.ok || (await response.json())?.ok !== true) throw Error();
    }).catch(() => {
        if (panel.hidden) return;
        clearTimeout(timer);
        byId('save').disabled = byId('refresh').disabled = false;
        status.textContent = 'Demande indisponible. Actualise pour reprendre.';
    });
}

function render(data) {
    current = data;
    const list = byId('rows');
    list.replaceChildren();
    for (const row of data.rows) {
        const tr = list.insertRow();
        const name = tr.insertCell();
        name.textContent = row.name;
        const detail = document.createElement('small');
        const variants = row.variants === 1 ? '1 variante' : row.variants + ' variantes';
        detail.textContent = row.missing ? 'Dossier absent' : row.readable ? row.model + ' · ' + variants : 'Métadonnées illisibles';
        name.append(detail);
        const badge = document.createElement('span');
        badge.className = row.loaded ? 'loaded' : 'inactive';
        badge.textContent = row.loaded === undefined ? 'Indéterminé' : row.loaded ? 'Actif' : 'Inactif';
        tr.insertCell().append(badge);
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = row.selected;
        check.dataset.name = row.name;
        check.setAttribute('aria-label', 'Activer au redémarrage · ' + row.name);
        if (!row.readable) {
            check.disabled = !row.selected;
            check.addEventListener('change', () => { check.disabled = !check.checked; });
        }
        const choice = document.createElement('label');
        const state = document.createElement('span');
        const update = () => {
            state.textContent = check.checked ? 'Activé' : 'Désactivé';
            tr.classList.toggle('changed', row.loaded !== undefined && check.checked !== row.loaded);
        };
        check.addEventListener('change', update);
        update();
        choice.append(check, state);
        tr.insertCell().append(choice);
    }
}

window.addEventListener('message', ({ data }) => {
    if (data?.kind === 'close') {
        panel.hidden = true;
        current = undefined;
        clearTimeout(timer);
    } else if (data?.kind === 'catalog' && data.payload) {
        const first = panel.hidden;
        panel.hidden = false;
        clearTimeout(timer);
        byId('save').disabled = byId('refresh').disabled = false;
        status.textContent = data.payload.error ?? (data.payload.saved ? 'Choix enregistrés pour le prochain redémarrage.' : '');
        if (Array.isArray(data.payload.rows)) render(data.payload);
        if (first) byId('refresh').focus();
    }
});
byId('close').addEventListener('click', () => post('close'));
byId('refresh').addEventListener('click', () => pending(post('refresh')));
byId('save').addEventListener('click', () => {
    if (!current) return;
    const selected = [...byId('rows').querySelectorAll('input:checked')].map(input => input.dataset.name);
    pending(post('save', { revision: current.revision, selected }));
});
window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
        event.preventDefault();
        post('close').catch(() => {});
    }
});
