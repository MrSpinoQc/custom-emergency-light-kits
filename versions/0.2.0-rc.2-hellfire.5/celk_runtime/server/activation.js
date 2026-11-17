'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual, TextDecoder } = require('node:util');
const { resolveModel, mountPath, sha256 } = require('./model-exports.js');
const { loadPack } = require('./packs.js');
const { identity: hellfire } = require('./hellfire-v06.js');
const { definitions: hellfireModernPacks } = require('./hellfire-studio-q.js');

const INDEX = 'active-models.json';
const MANIFEST = 'model-export.json';
const ATELIER_MANIFEST = 'livraison.json';
const LOCK = '.model-activation.lock';
const SCHEMA = 'tryagain.model-activation';
const VERSION = 2;
const MAX_MODELS = 128;
const MAX_MANIFEST = 128 * 1024;
const MAX_MOUNT = 2 * 1024 * 1024;
const MAX_INDEX = 2 * 1024 * 1024;
const SEGMENT = /^[a-z0-9][a-z0-9_.-]{0,63}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const PACK_KEY = /^[a-z0-9][a-z0-9_.-]{0,63}@[0-9a-zA-Z.-]{1,64}$/;
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
    if (!bytes) return { schema: SCHEMA, version: VERSION, models: {}, history: {}, retired: {}, packHashes: {} };
    let index;
    try { index = JSON.parse(decoder.decode(bytes)); }
    catch { throw new Error('Index d’activation : JSON UTF-8 illisible'); }
    const legacy = fields(index, 'schema', 'version', 'models', 'history') && index.version === 1;
    demand((legacy || (fields(index, 'schema', 'version', 'models', 'history', 'retired', 'packHashes') &&
        index.version === VERSION && object(index.retired) && object(index.packHashes))) && index.schema === SCHEMA &&
        object(index.models) && object(index.history), 'Index d’activation incompatible');
    if (legacy) index = { ...index, version: VERSION, retired: {}, packHashes: {} };
    demand(Object.entries(index.packHashes).every(([key, value]) => PACK_KEY.test(key) &&
        typeof value === 'string' && SHA256.test(value)), 'Empreinte de pack archivée invalide');
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
    for (const [name, record] of Object.entries(index.retired)) {
        const archived = index.history[record?.sha256];
        demand(indexRecord(record) && record.model === name && !Object.hasOwn(index.models, name) &&
            Object.hasOwn(index.history, record.sha256) && archived.model === name &&
            archived.publisher === record.publisher && archived.revision === record.revision,
        'Retrait sans historique concordant');
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

function createActivation({ root, scopes, compileMount, runtimeVersion, configuredPacks = new Map() }) {
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

    function verifyPacks(index, release, recordNew = false) {
        for (const variant of release.variants.values()) for (const [key, digest] of Object.entries(variant.dependencies ?? {})) {
            demand(PACK_KEY.test(key) && typeof digest === 'string' && SHA256.test(digest), 'Identité de pack compilée invalide');
            const accepted = index.packHashes[key];
            demand(accepted === undefined || accepted === digest, `Manifeste modifié pour ${key}. Rétablir le pack ou changer sa version.`);
            if (recordNew) index.packHashes[key] = digest;
        }
        return release;
    }

    function verifySealed(index, record, recordNew = false) {
        return verifyPacks(index, verifyDelivery(record, sealedDelivery(base, record)), recordNew);
    }

    function jsonObject(bytes, label) {
        let value;
        try { value = JSON.parse(decoder.decode(bytes)); }
        catch { throw new Error(`${label} : JSON UTF-8 illisible`); }
        demand(object(value), `${label} : objet JSON requis`);
        return value;
    }

    function verifyIncludedPacks(segments, declared, release) {
        demand(Array.isArray(declared) && declared.length > 0 && declared.length <= 32, 'Ensemble : dépendances de packs requises');
        const expected = new Map([...release.variants.values()].flatMap(variant => Object.entries(variant.dependencies)));
        const names = new Set();
        const resources = path.join(base, ...segments, 'resources');
        directory(resources, 'resources');
        for (const entry of declared) {
            demand(fields(entry, 'id', 'version', 'resource', 'sha256') && identifier(entry.id) &&
                typeof entry.version === 'string' && typeof entry.resource === 'string' &&
                /^[a-zA-Z0-9_-]{1,64}$/.test(entry.resource) && segment(entry.resource) &&
                typeof entry.sha256 === 'string' && SHA256.test(entry.sha256), 'Ensemble : dépendance de pack invalide');
            const key = entry.id + '@' + entry.version;
            const approved = configuredPacks.get(entry.id);
            demand(expected.get(key) === entry.sha256 && approved?.version === entry.version &&
                approved.resource === entry.resource && approved.sha256 === entry.sha256 &&
                !names.has(entry.resource), `Ensemble : pack ${key} absent, redondant ou différent du pack installé`);
            expected.delete(key);
            names.add(entry.resource);
            const folder = path.join(resources, entry.resource);
            directory(folder, entry.resource);
            loadPack(folder, entry, entry.id, { dataOnly: true });
        }
        demand(!expected.size && fs.readdirSync(resources).every(file => names.has(file)),
            'Ensemble : inventaire des dépendances ou ressources incomplet ou superflu');
    }

    function planInstallSet(index, name) {
        demand(segment(name), 'Ensemble : nom de dossier invalide');
        const segments = ['install-sets', name];
        const envelopeBytes = safeRead(base, [...segments, 'installation.json'], MAX_MANIFEST);
        const envelope = jsonObject(envelopeBytes, 'Ensemble');
        // Preserve compatibility with the original envelopes for the qualified pack families.
        const olderHellfire = (runtimeVersion === '0.2.0-rc.2-hellfire.2' && envelope.runtime === '0.2.0-rc.2-hellfire.1') ||
            (runtimeVersion === '0.2.0-rc.2-hellfire.3' && ['0.2.0-rc.2-hellfire.1', '0.2.0-rc.2-hellfire.2'].includes(envelope.runtime)) ||
            (['0.2.0-rc.2-hellfire.4', '0.2.0-rc.2-hellfire.5'].includes(runtimeVersion) && ['0.2.0-rc.2-hellfire.1', '0.2.0-rc.2-hellfire.2'].includes(envelope.runtime));
        const reviewedHellfire = ['0.2.0-rc.2-hellfire.4', '0.2.0-rc.2-hellfire.5'].includes(runtimeVersion) &&
            (envelope.runtime === '0.2.0-rc.2-hellfire.3' ||
                (runtimeVersion === '0.2.0-rc.2-hellfire.5' && envelope.runtime === '0.2.0-rc.2-hellfire.4'));
        const olderPhantom = ['0.2.0-rc.2-hellfire.3', '0.2.0-rc.2-hellfire.4', '0.2.0-rc.2-hellfire.5'].includes(runtimeVersion) &&
            envelope.runtime === '0.2.0-rc.2-ensemble.1';
        demand(fields(envelope, 'schema', 'version', 'runtime', 'selection', 'packs') &&
            envelope.schema === 'tryagain.vehicle-install-set' && envelope.version === 1 &&
            typeof runtimeVersion === 'string' && (envelope.runtime === runtimeVersion || olderHellfire || reviewedHellfire || olderPhantom),
        'Ensemble : schéma incompatible ou version CELK différente');
        demand(fields(envelope.selection, 'file', 'sha256') && envelope.selection.file === 'selection/selection.celk' &&
            typeof envelope.selection.sha256 === 'string' && SHA256.test(envelope.selection.sha256),
        'Ensemble : référence de sélection invalide');
        const selectionRoot = [...segments, 'selection'];
        const selection = { name, bytes: safeRead(base, [...selectionRoot, 'selection.celk'], MAX_MANIFEST),
            file: { segments: selectionRoot, mounts: new Map() } };
        const digest = sha256(selection.bytes);
        demand(digest === envelope.selection.sha256, 'Ensemble : empreinte de la sélection différente');
        const doc = jsonObject(selection.bytes, 'Sélection');
        const { model, publisher, revision } = doc;
        demand(!olderHellfire || (model === 'gauntlet4' && Array.isArray(doc.configurations) && doc.configurations.every(spec =>
            Array.isArray(spec?.packs) && spec.packs.some(pack => pack?.id === hellfire.id && pack.version === hellfire.version) &&
            spec.packs.every(pack => !hellfireModernPacks.has(pack?.id)))),
        'Ensemble : compatibilité du runtime précédent réservée au Hellfire V06');
        demand(!reviewedHellfire || model === 'gauntlet4',
            'Ensemble : compatibilité hellfire.3 réservée au Hellfire');
        demand(!olderPhantom || (model === 'phantom' && Array.isArray(doc.configurations) && doc.configurations.every(spec =>
            Array.isArray(spec?.packs) && spec.packs.length === 1 && spec.packs[0]?.id === 'phantom-grand-format' &&
            spec.packs[0].version === '0.1.0')), 'Ensemble : compatibilité ensemble.1 réservée au Phantom grand format 0.1.0');
        demand(publishers.has(model) && publishers.get(model) === publisher, 'Ensemble : modèle ou provenance non autorisés');
        demand(!Object.hasOwn(index.retired, model), 'Ensemble : modèle retiré. Restaurer une livraison approuvée avant ajout.');
        const incoming = verifyPacks(index, verifyDelivery({ model, publisher, revision, sha256: digest }, selection, true));
        verifyIncludedPacks(segments, envelope.packs, incoming);

        const current = Object.hasOwn(index.models, model) ? index.models[model] : undefined;
        demand(!current || current.publisher === publisher, 'Ensemble : provenance de la livraison active différente');
        const baseline = current ? sealedDelivery(base, current) : undefined;
        const installed = baseline ? verifyPacks(index, verifyDelivery(current, baseline, true)) : undefined;
        const original = baseline ? JSON.parse(decoder.decode(baseline.bytes)).configurations : [];
        const additions = doc.configurations.filter(spec => {
            const old = installed?.variants.get(spec.id);
            if (!old) return true;
            const next = incoming.variants.get(spec.id);
            demand(old.service === next.service && old.label === next.label && old.mountSha256 === next.mountSha256 &&
                isDeepStrictEqual(old.dependencies, next.dependencies),
            `Ensemble : variante ${spec.id} déjà installée avec un contenu différent`);
            return false;
        });
        function summary(record, candidate) {
            const token = sha256(Buffer.from(JSON.stringify([sha256(envelopeBytes), current?.sha256 ?? null, record.sha256])));
            return { record, candidate, token, kept: original.length, added: additions.length };
        }
        if (!additions.length) return summary(current);

        let highest = 0;
        for (const record of Object.values(index.history)) {
            if (record.model === model && record.publisher === publisher) highest = Math.max(highest, record.revision);
        }
        for (const candidate of inbox(base, model)) {
            if (!candidate.bytes) continue;
            try {
                const pending = JSON.parse(decoder.decode(candidate.bytes));
                if (pending?.model === model && pending.publisher === publisher && Number.isSafeInteger(pending.revision)) {
                    highest = Math.max(highest, pending.revision);
                }
            } catch { continue; }
        }
        const nextRevision = highest + 1;
        demand(Number.isSafeInteger(nextRevision), 'Ensemble : compteur de révision saturé');
        const mounts = new Map();
        function copy(spec, from) {
            const { sha256: hash, file } = spec.mount;
            const relative = `montages/${hash}.json`;
            const { bytes } = from.file.mounts.get(file.toLowerCase());
            mounts.set(relative, { relative, bytes });
            return { ...spec, mount: { file: relative, sha256: hash } };
        }
        const configurations = [...original.map(spec => copy(spec, baseline)), ...additions.map(spec => copy(spec, selection))];
        const bytes = Buffer.from(JSON.stringify({ ...doc, revision: nextRevision, configurations }, null, 2) + '\n');
        demand(bytes.length <= MAX_MANIFEST, 'Ensemble : manifeste assemblé trop volumineux');
        const candidate = { name, bytes, file: { mounts } };
        const record = { model, publisher, revision: nextRevision, sha256: sha256(bytes) };
        verifyPacks(index, verifyDelivery(record, candidate));
        return summary(record, candidate);
    }

    function plan(index, pins, target) {
        demand(target === undefined || publishers.has(target), 'Modèle non autorisé');
        demand(object(pins) && Object.entries(pins).every(([model, pin]) => publishers.has(model) &&
            (target === undefined || model === target) && fields(pin, 'revision', 'sha256') && revisionKey(pin)), 'Épingle par modèle invalide');
        const selected = new Map();
        const reports = new Map();
        for (const [model, publisher] of models) {
            if (target !== undefined && model !== target) continue;
            const pin = Object.hasOwn(pins, model) ? pins[model] : undefined;
            try {
                const old = Object.hasOwn(index.models, model) ? index.models[model] : undefined;
                const retired = Object.hasOwn(index.retired, model) ? index.retired[model] : undefined;
                if (retired && !pin) {
                    reports.set(model, { ok: target === undefined, model, publisher,
                        message: 'modèle retiré ; restauration explicite par révision et empreinte', reports: [] });
                    continue;
                }
                if (retired) demand(retired.publisher === publisher, 'Provenance du retrait différente');
                const historical = pin && Object.hasOwn(index.history, pin.sha256) ? index.history[pin.sha256] : undefined;
                const pinned = historical?.model === model && historical.publisher === publisher &&
                    historical.revision === pin.revision;
                const candidates = pinned ? [sealedDelivery(base, historical)] : inbox(base, model);
                if (!pin && old?.publisher === publisher) candidates.push(sealedDelivery(base, old));
                if (!candidates.length) throw new Error(`${model} : aucune livraison`);
                const result = resolve(model, publisher, candidates, pin);
                const { active, ...report } = result;
                if (result.ok) verifyPacks(index, active);
                reports.set(model, report);
                if (result.ok) selected.set(model, { active, candidate: candidates.find(candidate => candidate.name === active.name) });
            } catch (error) {
                reports.set(model, { ok: false, model, publisher, message: error.message, reports: [] });
            }
        }
        const ok = [...reports.values()].every(report => report.ok);
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

    function modify(action) {
        directory(base, 'Données d’activation');
        const { lockPath, descriptor } = lock();
        try { return action(readIndex(base)); }
        finally {
            fs.closeSync(descriptor);
            fs.unlinkSync(lockPath);
        }
    }

    return {
        previewInstallSet(name) {
            const { record, token, kept, added } = planInstallSet(readIndex(base), name);
            return { record, token, kept, added };
        },
        installSet(name, expectedToken) {
            return modify(index => {
                const { record, candidate, token, kept, added } = planInstallSet(index, name);
                demand(typeof expectedToken === 'string' && token === expectedToken,
                    'Ensemble : plan modifié. Relancer celk_preflight_set avant installation.');
                if (added) {
                    demand(Object.hasOwn(index.models, record.model) || Object.keys(index.models).length < MAX_MODELS,
                        'Trop de modèles actifs dans l’index');
                    seal(base, record, candidate);
                    verifySealed(index, record, true);
                    Object.defineProperty(index.models, record.model, { value: record, enumerable: true, configurable: true, writable: true });
                    index.history[record.sha256] = record;
                    writeIndex(base, index);
                }
                return { record, token, kept, added };
            });
        },
        preview({ pins = {}, model } = {}) {
            return plan(readIndex(base), pins, model).publicPlan;
        },
        activate({ pins = {}, model: target } = {}) {
            if (!directory(base, 'Données d’activation', true)) return plan(readIndex(base), pins, target).publicPlan;
            return modify(index => {
                const { publicPlan, selected } = plan(index, pins, target);
                if (!publicPlan.ok) return publicPlan;

                let changed = false;
                for (const [model, { active: { publisher, revision, sha256 }, candidate }] of selected) {
                    const record = { model, publisher, revision, sha256 };
                    if (Object.hasOwn(index.models, model) && index.models[model].sha256 === sha256) continue;
                    const snapshot = { ...candidate, file: { segments: candidate.file.segments, mounts: new Map() } };
                    verifyDelivery(record, snapshot, true);
                    seal(base, record, snapshot);
                    publicPlan.models.set(model, verifySealed(index, record, true));
                    Object.defineProperty(index.models, model, { value: record, enumerable: true, configurable: true, writable: true });
                    index.history[sha256] = record;
                    delete index.retired[model];
                    changed = true;
                }
                demand(Object.keys(index.models).length <= MAX_MODELS, 'Trop de modèles actifs dans l’index');
                if (changed) writeIndex(base, index);
                return { ...publicPlan, changed };
            });
        },
        retire(model) {
            demand(publishers.has(model), 'Modèle non autorisé');
            return modify(index => {
                if (Object.hasOwn(index.retired, model)) return false;
                demand(Object.hasOwn(index.models, model), 'Aucune livraison active à retirer');
                const record = index.models[model];
                demand(record.publisher === publishers.get(model), 'Provenance du modèle actif différente');
                Object.defineProperty(index.retired, model, { value: record, enumerable: true, configurable: true, writable: true });
                delete index.models[model];
                writeIndex(base, index);
                return true;
            });
        },
        indexed() {
            const index = readIndex(base);
            return { active: new Map(Object.entries(index.models)), retired: new Map(Object.entries(index.retired)) };
        },
        load() {
            const index = readIndex(base);
            return new Map(Object.entries(index.models).map(([model, record]) => {
                demand(publishers.get(model) === record.publisher, `Provenance du modèle actif ${model} modifiée`);
                return [model, verifySealed(index, record)];
            }));
        },
        loadReady() {
            const ready = new Map(), refused = new Map();
            const index = readIndex(base);
            for (const [model, record] of Object.entries(index.models)) {
                try {
                    demand(publishers.get(model) === record.publisher, 'Provenance du modèle actif modifiée ou absente');
                    ready.set(model, verifySealed(index, record));
                } catch (error) { refused.set(model, error.message); }
            }
            return { ready, refused };
        },
        loadVersion(model, pin) {
            demand(publishers.has(model) && fields(pin, 'revision', 'sha256') && revisionKey(pin), 'Révision demandée invalide');
            const index = readIndex(base);
            const accepted = index.history[pin.sha256];
            if (!accepted || accepted.model !== model || accepted.publisher !== publishers.get(model) ||
                accepted.revision !== pin.revision) return undefined;
            return verifySealed(index, accepted);
        },
    };
}

module.exports = { createActivation };
