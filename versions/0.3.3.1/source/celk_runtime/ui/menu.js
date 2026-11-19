'use strict';

const menu = document.querySelector('#menu');
const choices = document.querySelector('#choices');
const close = document.querySelector('#close');
const status = document.querySelector('#status');
const titles = new Map([['police', 'Police'], ['ambulance', 'Ambulance'], ['mecano', 'Mécano']]);
let session, pending, movementTimer;

function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function announce(text) {
    status.textContent = text ?? '';
    status.hidden = !text;
}

async function send(route, data = {}) {
    const token = { session };
    if (route === 'action') {
        if (pending) return;
        pending = token;
        menu.setAttribute('aria-busy', 'true');
    }
    try {
        const response = await fetch('https://' + GetParentResourceName() + '/' + route, {
            method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({ ...data, session: token.session }),
        });
        if (!response.ok || (await response.json())?.ok !== true) throw Error();
    } catch {
        if (route === 'action' && pending === token) {
            pending = undefined;
            menu.removeAttribute('aria-busy');
            announce('Commande indisponible. Vérifie le montage ou réessaie.');
        }
    }
}

function action(item, type, { label = item.label, active, className = '', icon } = {}) {
    const button = node('button', className);
    button.type = 'button';
    button.dataset.action = type;
    button.dataset.id = item.id;
    if (typeof active === 'boolean') button.setAttribute('aria-pressed', String(active));
    if (icon) {
        const symbol = node('span', 'mode-icon', icon);
        symbol.setAttribute('aria-hidden', 'true');
        button.append(symbol, node('span', '', label));
        button.setAttribute('aria-label', item.label);
    } else {
        button.textContent = label;
    }
    button.addEventListener('click', () => send('action', { action: type, id: item.id }));
    return button;
}

function section(title, className = '') {
    const card = node('section', 'card ' + className);
    card.append(node('h2', '', title));
    return card;
}

function showMounts(items, selected) {
    for (const item of items) {
        const installed = item.id === selected;
        const card = node('article', 'card mount-card' + (installed ? ' installed' : ''));
        const detail = node('div');
        const service = titles.get(item.service) ?? item.service;
        detail.append(node('h2', '', item.label));
        if (service && service !== item.label) detail.append(node('p', 'detail', service));
        card.append(detail, installed
            ? node('span', 'selected-label', '✓ Installé')
            : action(item, 'variant', { label: 'Installer', className: 'primary' }));
        if (!installed) card.lastElementChild.setAttribute('aria-label', 'Installer ' + item.label);
        choices.append(card);
    }
    if (!items.length) announce('Aucun montage disponible pour ce véhicule.');
}

function showRamp(options) {
    const byId = new Map(options.rampControls.map(item => [item.id, item]));
    const rampAction = (id, properties) => action(byId.get(id), 'sadler', properties);
    const open = byId.get('open').on === true;
    const moving = options.rampMotion?.remainingMs > 0;
    const shutter = section('Volet', 'stack shutter');
    const shutterRow = node('div', 'shutter-control');
    const settled = open ? 'Déployé' : 'Replié';
    const state = node('p', 'shutter-state', moving ? (open ? 'Déploiement…' : 'Repli…') : settled);
    const symbol = node('span', open ? 'shutter-icon raised' : 'shutter-icon');
    symbol.setAttribute('aria-hidden', 'true');
    shutterRow.append(symbol, state, rampAction(open ? 'close' : 'open', {
        label: open ? 'Replier' : 'Déployer', className: 'primary',
    }));
    shutter.append(shutterRow);
    if (moving) {
        movementTimer = setTimeout(() => { state.textContent = settled; }, options.rampMotion.remainingMs);
    }

    const presets = section('Motif du volet', 'motifs');
    const controlRow = node('div', 'section-heading');
    const armed = byId.get('armed').on;
    const paused = byId.get('paused').on;
    controlRow.append(rampAction('armed', { label: armed ? '✓ Armé' : 'Armer', active: armed }),
        rampAction('paused', { label: paused ? 'Reprendre' : 'Pause', active: paused }));
    const modes = node('div', 'choice-row');
    for (const [key, label, icon] of [['ligne', 'Ligne', '•••••'], ['gauche', 'Gauche', '←'],
        ['droite', 'Droite', '→'], ['double', 'Double', '← →']]) {
        const id = 'mode:' + key;
        if (byId.has(id)) modes.append(rampAction(id, { label, icon, active: byId.get(id).on, className: 'mode-button' }));
    }
    presets.append(controlRow, modes);

    const lights = section('Éclairage');
    const switches = node('div', 'stack');
    const segments = node('div', 'segment-row');
    for (const id of ['coins:off', 'coins:linked', 'coins:independent']) {
        const item = byId.get(id);
        if (item) segments.append(rampAction(id, { active: item.on, className: 'segment' }));
    }
    switches.append(node('h3', '', 'Coins ambre'), segments);
    const whites = node('div', 'setting light-switches');
    const on = byId.get('serviceLights').on;
    whites.append(node('h3', '', 'Feux blancs'), rampAction('serviceLights', {
        label: on ? 'Allumés' : 'Éteints', active: on,
    }));
    whites.lastElementChild.setAttribute('aria-label', 'Feux blancs · ' + (on ? 'allumés' : 'éteints'));
    switches.append(whites);
    lights.append(switches);
    choices.append(shutter, presets, lights);
}

function showScenes(options) {
    if (options.choices.length) {
        const card = section('Séquences');
        const grid = node('div', 'choice-list');
        for (const item of options.choices) grid.append(action(item, 'scene', { active: item.id === options.selected }));
        card.append(grid);
        choices.append(card);
    }
    if (options.projectors?.length) {
        const card = section('Projecteurs');
        if (options.projectors.some(head => head.aimable)) {
            card.append(node('p', 'detail', 'Visée au pavé numérique'));
        }
        const grid = node('div', 'choice-list');
        for (const head of options.projectors) {
            const state = head.on ? 'Allumé' : 'Éteint';
            const angle = head.aimable ? ' · ' + head.yaw + '° / ' + head.pitch + '°' : '';
            grid.append(action(head, 'projector', { label: head.label + ' · ' + state + angle, active: head.selected }));
        }
        card.append(grid);
        choices.append(card);
    }
}

window.addEventListener('message', ({ data }) => {
    if (data?.type === 'close') {
        if (menu.contains(document.activeElement)) document.activeElement.blur();
        menu.hidden = true;
        session = pending = undefined;
        menu.removeAttribute('aria-busy');
        clearTimeout(movementTimer);
        return;
    }
    if (data?.type !== 'open' || !Number.isInteger(data.session) || !Array.isArray(data.options?.choices)) return;
    const options = data.options;
    const fitting = options.pane === 'variants';
    const ramp = !fitting && options.rampControls?.some(item => item.id === 'open');
    const last = data.session === session ? document.activeElement : null;
    session = data.session;
    pending = undefined;
    menu.removeAttribute('aria-busy');
    clearTimeout(movementTimer);
    choices.replaceChildren();
    menu.classList.toggle('mounts', fitting);
    choices.className = ramp ? 'ramp-grid' : fitting ? '' : 'scene-grid';
    document.querySelector('#key').textContent = fitting ? 'F6' : 'J';
    document.querySelector('#title').textContent = fitting ? 'Montages' :
        ramp ? (options.service === 'mecano' ? 'Remorqueur' : 'Rampe Police') : 'Scènes';
    const subtitle = document.querySelector('#subtitle');
    const model = typeof options.model === 'string' ? options.model.replace(/^./, c => c.toUpperCase()) : '';
    subtitle.textContent = fitting || ramp ? model : options.mountLabel ?? model;
    subtitle.hidden = !subtitle.textContent;
    announce(options.notice);
    if (fitting) showMounts(options.choices, options.selected);
    else if (ramp) showRamp(options);
    else showScenes(options);
    menu.hidden = false;
    const buttons = [...choices.querySelectorAll('button')];
    const focus = last === close ? close : buttons.find(button =>
        button.dataset.action === last?.dataset.action && button.dataset.id === last?.dataset.id);
    (focus ?? choices.querySelector('button[aria-pressed="true"]') ?? buttons[0] ?? close).focus();
});

close.addEventListener('click', () => send('close'));
document.addEventListener('keydown', event => {
    if (menu.hidden) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        send('close');
    } else if (event.key === 'Tab') {
        const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});
