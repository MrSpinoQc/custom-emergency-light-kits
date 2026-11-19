'use strict';

const { createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');
const { maxAccessoriesPerVehicle } = require('../installation-limits.json');

const schema = 'tryagain.vehicle-model-export';
const services = new Set(['police', 'ambulance', 'mecano']);
const shaPattern = /^[0-9a-f]{64}$/;
const idPattern = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const decoder = new TextDecoder('utf-8', { fatal: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function requireValid(condition, message) {
    if (!condition) throw new Error(message);
}

function exactFields(value, fields) {
    return value && Object.getPrototypeOf(value) === Object.prototype &&
        Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function parse(bytes, limit, kind) {
    requireValid(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= limit, `${kind} : taille invalide`);
    try { return JSON.parse(decoder.decode(bytes)); }
    catch { throw new Error(`${kind} : JSON UTF-8 illisible`); }
}

function id(value) {
    return typeof value === 'string' && idPattern.test(value);
}

function revision(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function mountPath(value) {
    return typeof value === 'string' && value.length <= 192 &&
        /^(?:[a-zA-Z0-9][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9][a-zA-Z0-9_.-]*\.json$/.test(value) &&
        value.split('/').every(segment => !segment.endsWith('.') && !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(segment));
}

function header(bytes, model, publisher) {
    const doc = parse(bytes, 128 * 1024, 'Export modèle');
    requireValid(exactFields(doc, ['schema', 'version', 'publisher', 'model', 'revision', 'configurations']) &&
        doc.schema === schema && doc.version === 1, 'schéma d’export modèle incompatible');
    requireValid(doc.model === model && id(doc.model), 'modèle différent du dossier d’activation');
    requireValid(doc.publisher === publisher && id(doc.publisher), 'provenance incomparable ou non autorisée');
    requireValid(revision(doc.revision), 'révision entière positive requise');
    return doc;
}

function verifyConfiguration(spec, selected, file, readMount, compileMount) {
    const mount = spec.mount;
    requireValid(exactFields(mount, ['file', 'sha256']) && mountPath(mount.file) &&
        typeof mount.sha256 === 'string' && shaPattern.test(mount.sha256), `${spec.id} : référence de montage invalide`);
    requireValid(Array.isArray(spec.packs) && spec.packs.length > 0 && spec.packs.length <= 16,
        `${spec.id} : références aux packs obligatoires`);
    const packIds = new Set();
    for (const pack of spec.packs) {
        requireValid(exactFields(pack, ['id', 'version']) && id(pack.id) && !packIds.has(pack.id) &&
            typeof pack.version === 'string' && pack.version.length <= 64 && versionPattern.test(pack.version), `${spec.id} : pack invalide ou répété`);
        packIds.add(pack.id);
    }
    const bytes = readMount(file, mount.file);
    const doc = parse(bytes, 2 * 1024 * 1024, 'Montage');
    requireValid(hash(bytes) === mount.sha256, `${spec.id} : empreinte du montage différente`);
    requireValid(doc?.schema === 'tryagain.vehicle-mount' && doc.version === 1 && doc.project?.vehicle === selected.model &&
        Array.isArray(doc.project.attachments) && doc.project.attachments.length > 0 &&
        doc.project.attachments.length <= maxAccessoriesPerVehicle,
    `${spec.id} : montage v1, modèle concordant et de 1 à ${maxAccessoriesPerVehicle} pièces requis`);
    const keys = doc.project.attachments.map(part => part?.key);
    // Preserve the exported spelling. Only the sealed Airport Bus namespace maps to lowercase save IDs.
    const runtimeKeys = keys.map(key => selected.model === 'airbus' && typeof key === 'string' &&
        /^BUS-V01-(?:0[1-9]|1[0-9]|20)$/.test(key) ? key.toLowerCase() : key);
    requireValid(runtimeKeys.every(id) && new Set(runtimeKeys).size === keys.length,
        `${spec.id} : identifiant de pièce répété ou invalide`);
    const compiled = compileMount({ bytes, doc, model: selected.model, service: spec.service, packs: spec.packs });
    const parts = compiled?.parts;
    requireValid(Array.isArray(parts) && parts.length === keys.length &&
        parts.every((part, index) => part?.id === runtimeKeys[index] &&
            (runtimeKeys[index] === keys[index] || part.sourceKey === keys[index])),
    `${spec.id} : montage compilé incomplet ou réordonné`);
    return { ...compiled, id: spec.id, service: spec.service, label: spec.label, mountSha256: mount.sha256 };
}

function compileDelivery(selected, readMount, compileMount) {
    const { doc, sha256, name, file } = selected;
    requireValid(Array.isArray(doc.configurations) && doc.configurations.length > 0 && doc.configurations.length <= 64,
        'Une livraison doit contenir de 1 à 64 variantes. Pour retirer le modèle, utiliser celk_retire.');
    const variants = new Map();
    for (const spec of doc.configurations) {
        requireValid(exactFields(spec, ['id', 'service', 'label', 'packs', 'mount']) && id(spec.id) && !variants.has(spec.id) &&
            services.has(spec.service) && typeof spec.label === 'string' && spec.label === spec.label.trim() &&
            spec.label.length > 0 && spec.label.length <= 96 && !/[\x00-\x1f\x7f]/.test(spec.label),
        'configuration invalide ou identifiant de variante répété');
        variants.set(spec.id, verifyConfiguration(spec, doc, file, readMount, compileMount));
    }
    return { model: doc.model, publisher: doc.publisher, revision: doc.revision, sha256, name, variants };
}

function resolveModel({ model, publisher, candidates, pin, readMount, compileMount }) {
    requireValid(id(model) && id(publisher), 'provenance/modèle de résolution invalide');
    requireValid(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 128,
        `${model} : livraisons absentes ou trop nombreuses`);
    const reports = [];
    const grouped = new Map();
    for (const entry of [...candidates].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
        const report = { file: entry.name };
        reports.push(report);
        try {
            if (entry.error) throw new Error(entry.error);
            const doc = header(entry.bytes, model, publisher);
            const sha256 = hash(entry.bytes);
            Object.assign(report, { revision: doc.revision, sha256, status: 'candidate' });
            const group = grouped.get(doc.revision) ?? new Map();
            const copies = group.get(sha256) ?? [];
            copies.push({ ...entry, doc, sha256, report });
            group.set(sha256, copies);
            grouped.set(doc.revision, group);
        } catch (error) {
            Object.assign(report, { status: 'refused', reason: error.message });
        }
    }

    function refused(message) {
        return { ok: false, model, publisher, message, reports };
    }

    const groups = [...grouped].sort(([a], [b]) => b - a);
    for (const [number, versions] of groups) {
        if (versions.size < 2) continue;
        for (const copies of versions.values()) for (const copy of copies) {
            Object.assign(copy.report, { status: 'conflict', reason: `contenus divergents à la révision ${number}` });
        }
    }
    if (pin !== undefined && (!exactFields(pin, ['revision', 'sha256']) || !revision(pin.revision) ||
        typeof pin.sha256 !== 'string' || !shaPattern.test(pin.sha256))) return refused('épingle de retour invalide');
    if (!pin && reports.some(row => row.status === 'refused' || row.status === 'conflict')) {
        return refused('candidats ambigus ou illisibles. Corriger la remise ou conserver une activation épinglée');
    }

    const targetRevision = pin?.revision ?? groups[0]?.[0];
    const target = grouped.get(targetRevision);
    const targetSha = pin?.sha256 ?? target?.keys().next().value;
    if (target?.size !== 1 || !target.has(targetSha)) return refused('révision/empreinte choisie absente ou conflictuelle');

    const validCopies = [];
    for (const [number, versions] of groups) for (const copies of versions.values()) {
        for (const candidate of copies) {
            if (candidate.report.status === 'conflict') continue;
            try {
                const compiled = compileDelivery(candidate, readMount, compileMount);
                if (number === targetRevision && candidate.sha256 === targetSha) validCopies.push({ candidate, compiled });
                else Object.assign(candidate.report, { status: 'inactive', reason: pin ? 'révision non épinglée' : 'révision antérieure' });
            } catch (error) {
                Object.assign(candidate.report, { status: 'refused', reason: error.message });
            }
        }
    }
    if (!validCopies.length) return refused('livraison choisie incomplète ou incompatible');
    const [chosen, ...duplicates] = validCopies;
    chosen.candidate.report.status = 'active';
    for (const { candidate } of duplicates) {
        Object.assign(candidate.report, { status: 'duplicate', reason: 'même livraison et mêmes empreintes de montage' });
    }
    return { ok: true, active: chosen.compiled, reports };
}

module.exports = { resolveModel, mountPath, sha256: hash };
