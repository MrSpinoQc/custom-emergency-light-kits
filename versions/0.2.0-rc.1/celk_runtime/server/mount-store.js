'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { maxAccessoriesPerVehicle: MAX_PARTS } = require('../installation-limits.json');

const SCHEMA = 'tryagain.installed-mounts';
const VERSION = 1;
const SERVICES = new Set(['police', 'ambulance']);
const RECORD_FIELDS = ['model', 'publisher', 'revision', 'exportSha256', 'service', 'variantId', 'partIds'];
const LEGACY_FIELDS = ['id', 'model', 'service', 'preset', 'accessories'];
const MAPPING_FIELDS = ['vehicleId', 'model', 'service', 'preset', 'variantId'];

function plainObject(value) {
    return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnlyFields(value, fields) {
    return plainObject(value) && Reflect.ownKeys(value).length === fields.length
        && fields.every(field => Object.hasOwn(value, field));
}

function token(value) {
    return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function partId(value) {
    return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(value);
}

function assertVehicleId(vehicleId) {
    if (!token(vehicleId)) throw new TypeError('Identifiant durable de véhicule invalide');
}

function copyRecord(record) {
    return { ...record, partIds: [...record.partIds] };
}

function validateRecord(record) {
    if (!hasOnlyFields(record, RECORD_FIELDS) || !partId(record.model) || !partId(record.publisher)
        || !Number.isSafeInteger(record.revision) || record.revision < 1 || typeof record.exportSha256 !== 'string'
        || !/^[a-f0-9]{64}$/.test(record.exportSha256) || !SERVICES.has(record.service)
        || !partId(record.variantId) || !Array.isArray(record.partIds) || record.partIds.length > MAX_PARTS) {
        throw new TypeError('Montage persistant invalide');
    }
    const ids = new Set();
    for (const id of record.partIds) {
        if (!partId(id) || ids.has(id)) throw new TypeError('Identifiant de pièce invalide ou répété');
        ids.add(id);
    }
    return copyRecord(record);
}

function readMounts(filename) {
    let contents;
    try {
        contents = fs.readFileSync(filename, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return new Map();
        throw error;
    }

    const document = JSON.parse(contents);
    if (!hasOnlyFields(document, ['schema', 'version', 'vehicles']) || document.schema !== SCHEMA
        || document.version !== VERSION || !plainObject(document.vehicles)) {
        throw new TypeError('Format du fichier des montages persistants invalide');
    }
    const records = new Map();
    for (const [id, record] of Object.entries(document.vehicles)) {
        assertVehicleId(id);
        records.set(id, validateRecord(record));
    }
    return records;
}

function saveMounts(filename, records) {
    const document = { schema: SCHEMA, version: VERSION, vehicles: Object.fromEntries(records) };
    const temporary = path.join(path.dirname(filename), `.${path.basename(filename)}.${randomUUID()}.tmp`);
    const file = fs.openSync(temporary, 'wx', 0o600);
    let committed = false;
    try {
        try {
            fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
            fs.fsyncSync(file);
        } finally {
            fs.closeSync(file);
        }
        fs.renameSync(temporary, filename);
        committed = true;
    } finally {
        if (!committed) {
            try {
                fs.unlinkSync(temporary);
            } catch {
                // Retain the original write error if removing the temporary file also fails.
            }
        }
    }
}

function createMountStore(filename) {
    const destination = path.resolve(filename);
    // Reject an invalid file when opening the resource, before accepting operations.
    readMounts(destination);
    return {
        get(id) {
            assertVehicleId(id);
            const record = readMounts(destination).get(id);
            return record && copyRecord(record);
        },
        set(id, record) {
            assertVehicleId(id);
            const next = validateRecord(record);
            const records = readMounts(destination);
            const previous = records.get(id);
            if (previous && next.model !== previous.model) {
                throw new Error('Le modèle diffère du véhicule déjà enregistré');
            }
            records.set(id, next);
            if (!isDeepStrictEqual(next, previous)) saveMounts(destination, records);
            return copyRecord(next);
        },
        remove(id) {
            assertVehicleId(id);
            const records = readMounts(destination);
            if (!records.delete(id)) return false;
            saveMounts(destination, records);
            return true;
        },
        entries() {
            return [...readMounts(destination)].map(([id, record]) => [id, copyRecord(record)]);
        },
    };
}

function migrateLegacyRecord(record, { vehicleId, modelExport, mapping }) {
    assertVehicleId(vehicleId);
    if (!hasOnlyFields(record, LEGACY_FIELDS) || record.id !== vehicleId || !Array.isArray(record.accessories)
        || record.accessories.length > MAX_PARTS || !partId(record.preset) || !SERVICES.has(record.service)
        || !hasOnlyFields(mapping, MAPPING_FIELDS) || mapping.vehicleId !== vehicleId || mapping.model !== record.model
        || mapping.service !== record.service || mapping.preset !== record.preset || !partId(mapping.variantId)
        || modelExport?.model !== record.model || !(modelExport.variants instanceof Map)) {
        throw new Error('Correspondance historique explicite requise pour le véhicule et son montage');
    }
    const variant = modelExport.variants.get(mapping.variantId);
    if (!variant || variant.id !== mapping.variantId || variant.service !== record.service
        || !Array.isArray(variant.parts)) {
        throw new Error('Variante de migration absente ou incompatible');
    }

    const targetParts = new Map(variant.parts.map(part => [part.id, part]));
    const partIds = record.accessories.map(part => {
        if (!plainObject(part) || !partId(part.id) || !isDeepStrictEqual(part, targetParts.get(part.id))) {
            throw new Error('Pièce historique différente de la définition cible');
        }
        return part.id;
    });
    return validateRecord({
        model: record.model,
        publisher: modelExport.publisher,
        revision: modelExport.revision,
        exportSha256: modelExport.sha256,
        service: record.service,
        variantId: mapping.variantId,
        partIds,
    });
}

module.exports = { createMountStore, migrateLegacyRecord };
