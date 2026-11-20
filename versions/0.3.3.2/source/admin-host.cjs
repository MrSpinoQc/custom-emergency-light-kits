'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, timingSafeEqual } = require('node:crypto');
const http = require('node:http');
const { normal, read, replace, id, readAdminSelection } = require('./prepare.cjs');

const jsonBytes = value => Buffer.from(JSON.stringify(value) + '\n');
const digest = value => createHash('sha256').update(value).digest('hex');
const encode = doc => JSON.parse(read(doc, 65536).toString('utf8'));

function preview(root, name) {
    let folder = path.join(root, name);
    try {
        if (!id(name) || !normal(folder).isDirectory()) throw Error('Dossier entrant invalide');
        if (!fs.existsSync(path.join(folder, 'installation.json'))) {
            const children = fs.readdirSync(folder);
            if (children.length !== 1 || !id(children[0])) throw Error('Racine ambiguë');
            folder = path.join(folder, children[0]);
            normal(folder);
        }
        const installation = encode(path.join(folder, 'installation.json'));
        const selection = encode(path.join(folder, 'selection/selection.celk'));
        if (!id(selection.model) || !id(selection.publisher) || !Array.isArray(selection.configurations)
            || !Array.isArray(installation.packs) || !installation.packs.length) throw Error('Contrat absent');
        return { name, model: selection.model, publisher: selection.publisher,
            variants: selection.configurations.length, readable: true };
    } catch {
        return { name, readable: false };
    }
}

function catalog(home, generation, accepted) {
    const incoming = path.join(home, 'packs');
    if (!normal(incoming).isDirectory()) throw Error('Dépôt indisponible');
    const entries = fs.readdirSync(incoming).sort();
    if (entries.length > 128) throw Error('Trop de dossiers entrants');
    const active = new Map(accepted.map(entry => [entry.name, entry.model]));
    const pending = readAdminSelection(home);
    const selected = pending ? pending.selected : [...active.keys()].sort();
    const byName = new Map(entries.filter(id).map(name => [name, preview(incoming, name)]));
    for (const name of [...new Set([...selected, ...active.keys()])]) {
        if (!byName.has(name)) byName.set(name, { name, missing: true, readable: false });
    }
    const rows = [...byName.values()].map(row => ({ ...row, active: active.has(row.name), activeModel: active.get(row.name),
        selected: selected.includes(row.name) }));
    const revision = digest(jsonBytes({ generation, pending: pending?.digest ?? null, rows }));
    return { generation, revision, rows };
}

function save(home, generation, accepted, request) {
    const state = catalog(home, generation, accepted);
    if (!request || Object.keys(request).length !== 2 || request.revision !== state.revision) throw Error('Liste modifiée. Actualise.');
    const selected = request.selected;
    if (!Array.isArray(selected) || selected.length > 128 || !selected.every(id) || new Set(selected).size !== selected.length) {
        throw Error('Sélection invalide.');
    }
    const selectable = new Set(state.rows.filter(row => row.readable).map(row => row.name));
    if (selected.some(name => !selectable.has(name))) throw Error('Un dossier sélectionné doit être corrigé ou retiré.');
    replace(path.join(home, 'selection-admin.json'), jsonBytes({
        schema: 'celk.admin-selection', version: 1, selected: selected.slice().sort(),
    }));
    return catalog(home, generation, accepted);
}

function createAdminServer({ home, current, key }) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw Error('Clé d’instance invalide');
    const authorized = Buffer.from('Bearer ' + key);
    return http.createServer({ requestTimeout: 3000, headersTimeout: 3000, maxHeaderSize: 4096 }, (req, res) => {
        function send(status, payload) {
            if (res.destroyed) return;
            res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(jsonBytes(payload));
        }
        const credential = Buffer.from(req.headers.authorization ?? '');
        if (credential.length !== authorized.length || !timingSafeEqual(credential, authorized)) return send(403, { error: 'Accès refusé.' });
        const active = current();
        if (!active) return send(503, { error: 'Génération non démarrée.' });
        const generation = active.name;
        const accepted = active.receipt.accepted;
        function withBootSelections(state) {
            return { ...state, bootSelections: active.receipt.activeSelections ?? {} };
        }
        if (req.method === 'GET' && req.url === '/catalog') {
            try { return send(200, withBootSelections(catalog(home, generation, accepted))); }
            catch { return send(503, { error: 'Inventaire de dépôt indisponible.' }); }
        }
        if (req.method !== 'PUT' || req.url !== '/selection') return send(404, { error: 'Action inconnue.' });
        const chunks = [];
        let bytes = 0;
        req.on('data', chunk => {
            bytes += chunk.length;
            if (bytes <= 16384) chunks.push(chunk);
            else if (!res.headersSent) send(413, { error: 'Sélection trop volumineuse.' });
        });
        req.on('error', () => res.destroy());
        req.on('end', () => {
            if (res.headersSent) return;
            try {
                const body = JSON.parse(Buffer.concat(chunks));
                send(200, withBootSelections(save(home, generation, accepted, body)));
            } catch {
                send(409, { error: 'Enregistrement refusé. Actualise la liste et vérifie la sélection.' });
            }
        });
    });
}

module.exports = { catalog, save, createAdminServer };
