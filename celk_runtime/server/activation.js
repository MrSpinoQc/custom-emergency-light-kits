'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { TextDecoder } = require('node:util');
const { resolveModel, mountPath, sha256 } = require('./model-exports.js');

const INDEX = 'active-models.json';
const MANIFEST = 'model-export.json';
const ATELIER_MANIFEST = 'livraison.json';
const LOCK = '.model-activation.lock';
const SCHEMA = 'tryagain.model-activation';
const VERSION = 1;
const MAX_MODELS = 128;
const MAX_MANIFEST = 128 * 1024;
const MAX_MOUNT = 2 * 1024 * 1024;
const MAX_INDEX = 2 * 1024 * 1024;
const SEGMENT = /^[a-z0-9][a-z0-9_.-]{0,63}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const decoder = new TextDecoder('utf-8', { fatal: true });

function demand(condition, message) {
    if (!condition) throw new Error(message);
}

function object(value) {
    return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function fields(value, ...keys) {
    return object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function segment(value) {
    return typeof value === 'string' && SEGMENT.test(value) && !value.endsWith('.') &&
        !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value);
}

function identifier(value) {
    return segment(value) && value === value.toLowerCase();
}

function revisionKey(value) {
    return Number.isSafeInteger(value.revision) && value.revision > 0 &&
        typeof value.sha256 === 'string' && SHA256.test(value.sha256);
}

function stat(file) {
    try { return fs.lstatSync(file); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function directory(file, label, optional = false) {
    const info = stat(file);
    if (!info && optional) return false;
    demand(info?.isDirectory(), `${label} : dossier normal requis`);
    return true;
}

function safeRead(base, names, limit, { optional = false } = {}) {
    if (!directory(base, 'Données d’activation', optional)) return null;
    let parent = base;
    for (const name of names.slice(0, -1)) {
        parent = path.join(parent, name);
        if (!directory(parent, name, optional)) return null;
    }
    const label = names.join('/');
    const filename = path.join(parent, names.at(-1));
    const before = stat(filename);
    if (!before && optional) return null;
    demand(before?.isFile(), `${label} : fichier normal requis`);
    demand(before.size > 0 && before.size <= limit, `${label} : taille invalide`);

    const descriptor = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = fs.fstatSync(descriptor);
        demand(opened.isFile() && opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size,
            `${label} : fichier modifié pendant la lecture`);
        const bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
            const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, null);
            demand(count > 0, `${label} : lecture incomplète`);
            offset += count;
        }
        const trailing = fs.readSync(descriptor, Buffer.alloc(1), 0, 1, null);
        const after = fs.fstatSync(descriptor);
        demand(trailing === 0 && after.mtimeMs === opened.mtimeMs, `${label} : fichier modifié pendant la lecture`);
        return bytes;
    } finally {
        fs.closeSync(descriptor);
    }
}

function writeNew(file, bytes) {
    const descriptor = fs.openSync(file, 'wx', 0o600);
    try {
        fs.writeFileSync(descriptor, bytes);
        fs.fsyncSync(descriptor);
    } finally {
        fs.closeSync(descriptor);
    }
}

function writeIndex(root, index) {
    const bytes = Buffer.from(JSON.stringify(index, null, 2) + '\n');
    demand(bytes.length <= MAX_INDEX, 'Index des versions trop volumineux');
    const temporary = path.join(root, `.active-models-${randomUUID()}.tmp`);
    try {
        writeNew(temporary, bytes);
        fs.renameSync(temporary, path.join(root, INDEX));
    } finally {
        if (stat(temporary)) fs.unlinkSync(temporary);
    }
}

function indexRecord(value) {
    return fields(value, 'model', 'publisher', 'revision', 'sha256') && identifier(value.model) &&
        identifier(value.publisher) && revisionKey(value);
}

function readIndex(root) {
    const bytes = safeRead(root, [INDEX], MAX_INDEX, { optional: true });
    if (!bytes) return { schema: SCHEMA, version: VERSION, models: {}, history: {} };
    let index;
    try { index = JSON.parse(decoder.decode(bytes)); }
    catch { throw new Error('Index d’activation : JSON UTF-8 illisible'); }
    demand(fields(index, 'schema', 'version', 'models', 'history') && index.schema === SCHEMA &&
        index.version === VERSION && object(index.models) && object(index.history), 'Index d’activation incompatible');
    for (const [hash, record] of Object.entries(index.history)) {
        demand(indexRecord(record) && hash === record.sha256, 'Révision historique invalide dans l’index');
    }
    const models = Object.entries(index.models);
    demand(models.length <= MAX_MODELS, 'Trop de modèles actifs dans l’index');
    for (const [name, record] of models) {
        demand(indexRecord(record) && record.model === name && Object.hasOwn(index.history, record.sha256) &&
            index.history[record.sha256].model === name && index.history[record.sha256].publisher === record.publisher &&
            index.history[record.sha256].revision === record.revision, 'Révision active sans historique concordant');
    }
    return index;
}

function mountReader(root, file, relative, capture) {
    demand(mountPath(relative) && ![MANIFEST, ATELIER_MANIFEST].includes(relative.toLowerCase()), 'Chemin de montage invalide');
    const canonical = relative.toLowerCase();
    const found = file.mounts.get(canonical);
    if (found) {
        demand(found.relative === relative, 'Chemins de montage en conflit sur un disque insensible à la casse');
        if (found.bytes) return Buffer.from(found.bytes);
    }
    const bytes = safeRead(root, [...file.segments, ...relative.split('/')], MAX_MOUNT);
    file.mounts.set(canonical, { relative, ...(capture ? { bytes } : {}) });
    return capture ? Buffer.from(bytes) : bytes;
}

function readDelivery(root, segments, name, fromInbox = false) {
    const canonical = safeRead(root, [...segments, MANIFEST], MAX_MANIFEST, { optional: fromInbox });
    const atelier = fromInbox && safeRead(root, [...segments, ATELIER_MANIFEST], MAX_MANIFEST, { optional: true });
    demand(canonical || atelier, `Aucun manifeste ${MANIFEST} ou ${ATELIER_MANIFEST}`);
    demand(!canonical || !atelier || canonical.equals(atelier), 'Les deux manifestes de la livraison divergent');
    return { name, bytes: canonical ?? atelier, file: { segments, mounts: new Map() } };
}

function inbox(root, model) {
    if (!directory(root, 'Données d’activation', true) || !directory(path.join(root, 'models'), 'models', true)) return [];
    const modelDir = path.join(root, 'models', model);
    if (!directory(modelDir, model, true)) return [];
    const entries = fs.readdirSync(modelDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() || entry.isSymbolicLink());
    demand(entries.length <= 128, `${model} : trop de livraisons`);
    return entries.map(({ name }) => {
        try {
            demand(segment(name), 'Nom de dossier de livraison invalide');
            return readDelivery(root, ['models', model, name], name, true);
        } catch (error) {
            return { name, error: error.message };
        }
    });
}

function sealedDelivery(root, record) {
    const candidate = readDelivery(root, ['accepted', record.sha256], `accepté/${record.sha256}`);
    demand(sha256(candidate.bytes) === record.sha256, 'Empreinte du manifeste scellé différente');
    return candidate;
}

function removeStaging(accepted, staging) {
    demand(path.isAbsolute(staging) && path.dirname(staging) === accepted &&
        /^\.staging-[a-z0-9-]+$/i.test(path.basename(staging)), 'Chemin du dossier temporaire invalide');
    fs.rmSync(staging, { force: true, recursive: true });
}

function seal(root, record, candidate) {
    const accepted = path.join(root, 'accepted');
    if (!directory(accepted, 'accepted', true)) fs.mkdirSync(accepted);
    const target = path.join(accepted, record.sha256);
    if (directory(target, record.sha256, true)) return;

    const staging = fs.mkdtempSync(path.join(accepted, '.staging-'));
    try {
        writeNew(path.join(staging, MANIFEST), candidate.bytes);
        for (const { relative, bytes } of candidate.file.mounts.values()) {
            const targetMount = path.join(staging, ...relative.split('/'));
            fs.mkdirSync(path.dirname(targetMount), { recursive: true });
            writeNew(targetMount, bytes);
        }
        fs.renameSync(staging, target);
    } finally {
        if (stat(staging)) removeStaging(accepted, staging);
    }
}

function createActivation({ root, scopes, compileMount }) {
    demand(typeof root === 'string' && root.length > 0 && object(scopes) && typeof compileMount === 'function',
        'Configuration d’activation invalide');
    const base = path.resolve(root);
    const models = Object.entries(scopes).sort(([a], [b]) => a.localeCompare(b));
    demand(models.length <= MAX_MODELS && models.every(([model, publisher]) => identifier(model) && identifier(publisher)),
        'Périmètre des modèles ou provenance invalide');
    const publishers = new Map(models);

    function resolve(model, publisher, candidates, pin, capture = false) {
        return resolveModel({ model, publisher, candidates, pin,
            readMount: (file, relative) => mountReader(base, file, relative, capture), compileMount });
    }

    function verifyDelivery(record, candidate, capture = false) {
        const result = resolve(record.model, record.publisher, [candidate],
            { revision: record.revision, sha256: record.sha256 }, capture);
        if (!result.ok) {
            const reason = result.reports.find(report => report.reason)?.reason;
            throw new Error(`Modèle ${record.model} r${record.revision} : ${reason ?? result.message}`);
        }
        return result.active;
    }

    function verifySealed(record) {
        return verifyDelivery(record, sealedDelivery(base, record));
    }

    function plan(index, pins) {
        demand(object(pins) && Object.entries(pins).every(([model, pin]) => publishers.has(model) &&
            fields(pin, 'revision', 'sha256') && revisionKey(pin)), 'Épingle par modèle invalide');
        const selected = new Map();
        const reports = new Map();
        for (const [model, publisher] of models) {
            const pin = Object.hasOwn(pins, model) ? pins[model] : undefined;
            try {
                const old = index.models[model];
                const historical = pin && index.history[pin.sha256];
                const pinned = historical?.model === model && historical.publisher === publisher &&
                    historical.revision === pin.revision;
                const candidates = pinned ? [sealedDelivery(base, historical)] : inbox(base, model);
                if (!pinned && old?.publisher === publisher) candidates.push(sealedDelivery(base, old));
                if (!candidates.length) throw new Error(`${model} : aucune livraison`);
                const result = resolve(model, publisher, candidates, pin);
                const { active, ...report } = result;
                reports.set(model, report);
                if (result.ok) selected.set(model, { active, candidate: candidates.find(candidate => candidate.name === active.name) });
            } catch (error) {
                reports.set(model, { ok: false, model, publisher, message: error.message, reports: [] });
            }
        }
        const ok = selected.size === models.length;
        const publicPlan = { ok, models: new Map(), reports };
        if (ok) for (const [model, { active }] of selected) publicPlan.models.set(model, active);
        return { publicPlan, selected };
    }

    function lock() {
        const lockPath = path.join(base, LOCK);
        try { return { lockPath, descriptor: fs.openSync(lockPath, 'wx', 0o600) }; }
        catch (error) {
            if (error.code === 'EEXIST') throw new Error('Une activation occupe déjà le dossier de données');
            throw error;
        }
    }

    return {
        preview({ pins = {} } = {}) {
            return plan(readIndex(base), pins).publicPlan;
        },
        activate({ pins = {} } = {}) {
            if (!directory(base, 'Données d’activation', true)) return plan(readIndex(base), pins).publicPlan;
            const { lockPath, descriptor } = lock();
            try {
                const index = readIndex(base);
                const { publicPlan, selected } = plan(index, pins);
                if (!publicPlan.ok) return publicPlan;

                const active = new Map();
                for (const [model, { active: { publisher, revision, sha256 }, candidate }] of selected) {
                    const record = { model, publisher, revision, sha256 };
                    const snapshot = { ...candidate, file: { segments: candidate.file.segments, mounts: new Map() } };
                    verifyDelivery(record, snapshot, true);
                    seal(base, record, snapshot);
                    publicPlan.models.set(model, verifySealed(record));
                    active.set(model, record);
                    index.history[sha256] = record;
                }
                index.models = Object.fromEntries(active);
                writeIndex(base, index);
                return publicPlan;
            } finally {
                fs.closeSync(descriptor);
                fs.unlinkSync(lockPath);
            }
        },
        load() {
            const index = readIndex(base);
            return new Map(Object.entries(index.models).map(([model, record]) => {
                demand(publishers.get(model) === record.publisher, `Provenance du modèle actif ${model} modifiée`);
                return [model, verifySealed(record)];
            }));
        },
        loadVersion(model, pin) {
            demand(publishers.has(model) && fields(pin, 'revision', 'sha256') && revisionKey(pin), 'Révision demandée invalide');
            const accepted = readIndex(base).history[pin.sha256];
            if (!accepted || accepted.model !== model || accepted.publisher !== publishers.get(model) ||
                accepted.revision !== pin.revision) return undefined;
            return verifySealed(accepted);
        },
    };
}

module.exports = { createActivation };
