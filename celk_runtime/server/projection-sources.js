'use strict';

const { isDeepStrictEqual } = require('node:util');

const space = 'part-mount-pivot';
const group = /^group:[1-9]\d?$/;
const sourceId = /^[a-zA-Z0-9_.:-]{1,96}$/;
const authoredSettings = ['enabled', 'rangeM', 'openingDeg', 'intensity', 'falloff', 'yawDeg', 'pitchDeg'];
const normalizedSettings = authoredSettings.slice(0, 5);
const blockFields = new Set(['pieceKey', 'model', 'opticId', 'color', 'space', 'settings', 'sources']);
const sourceFields = new Set(['id', 'emitterIndex', 'originM', 'originOffsetM', 'axis']);

function demand(condition, label) {
    if (!condition) throw new Error('Sources de projection · ' + label);
}

function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function vector(value, bound) {
    return Array.isArray(value) && value.length === 3 &&
        [value[0], value[1], value[2]].every(component => Number.isFinite(component) && Math.abs(component) <= bound);
}

function normalizedColor(part, opticId) {
    const optic = part.optics[opticId];
    const index = Number(opticId.slice('group:'.length)) - 1;
    const color = optic.color ?? optic.rgb ?? part.zones?.[index]?.color;
    return Array.isArray(color) ? color : [color?.r, color?.g, color?.b];
}

function resolveEmitters(block, optic, authored, key) {
    demand(Array.isArray(block.sources) && block.sources.length <= 16 && Array.isArray(optic.emitters) &&
        Array.isArray(authored.emitters), 'liste de sources invalide : ' + key);
    const used = new Set();
    return Array.from(block.sources, source => {
        demand(record(source) && Object.keys(source).every(field => sourceFields.has(field)) &&
            typeof source.id === 'string' && sourceId.test(source.id) && !used.has(source.id) &&
            Number.isInteger(source.emitterIndex) && source.emitterIndex >= 0 &&
            source.emitterIndex < authored.emitters.length && record(optic.emitters[source.emitterIndex]) &&
            vector(source.originM, 6) && vector(source.axis, 1.00001) &&
            Math.abs(Math.hypot(...source.axis) - 1) <= 0.00001 &&
            (!Object.hasOwn(source, 'originOffsetM') || vector(source.originOffsetM, 6)),
        'source ou identifiant invalide ou en double : ' + key);
        used.add(source.id);
        const normal = optic.emitters[source.emitterIndex].exposedFaceNormalLocal;
        demand(normal === undefined || (vector(normal, 16) && Math.hypot(...normal) >= 0.00001),
            'normale de source invalide : ' + key);
        // originM is already resolved in the local mount frame. originOffsetM is provenance only.
        return { sourceId: source.id, origin: [...source.originM], axis: [...source.axis],
            ...(normal === undefined ? {} : { exposedFaceNormalLocal: [...normal] }) };
    });
}

function resolveProjectionSources(parts, doc) {
    demand(Array.isArray(parts) && record(doc), 'montage normalisé invalide');
    if (!Object.hasOwn(doc, 'sourcesProjection')) return parts;
    const overrides = doc.sourcesProjection;
    demand(Array.isArray(overrides), 'sourcesProjection doit être une liste');
    if (overrides.length === 0) return parts;

    const byPart = new Map();
    for (const part of parts) {
        const key = part?.pieceKey ?? part?.id;
        demand(typeof key === 'string' && key.length > 0 && !byPart.has(key), 'clé de montage absente ou en double');
        byPart.set(key, part);
    }
    demand(Array.isArray(doc.diffusionsLentilles), 'diffusions Atelier introuvables');
    const authoredByPart = new Map();
    for (const diffusion of doc.diffusionsLentilles) {
        demand(typeof diffusion?.pieceKey === 'string' && !authoredByPart.has(diffusion.pieceKey),
            'clé de diffusion absente ou en double');
        authoredByPart.set(diffusion.pieceKey, diffusion);
    }

    const overridesByPart = new Map();
    for (const block of overrides) {
        demand(record(block) && Object.keys(block).every(field => blockFields.has(field)) &&
            typeof block.pieceKey === 'string' && typeof block.opticId === 'string' && group.test(block.opticId),
        'bloc ou optique de lentille invalide');
        const { pieceKey, opticId } = block;
        const key = pieceKey + '/' + opticId;
        const part = byPart.get(pieceKey);
        const optic = part?.optics?.[opticId];
        const diffusion = authoredByPart.get(pieceKey);
        demand(record(optic) && diffusion?.schema === 'tryagain.lens-diffusion' && diffusion.version === 1 &&
            Array.isArray(diffusion.optics), 'pièce ou optique de diffusion absente : ' + key);
        demand(typeof block.model === 'string' && block.model === part.model && block.model === diffusion.model,
            'modèle de source différent : ' + key);
        demand(block.space === space && diffusion.units?.space === space && diffusion.units.position === 'm',
            'repère local de source différent : ' + key);
        const matchingOptics = diffusion.optics.filter(candidate => candidate?.id === opticId);
        demand(matchingOptics.length === 1, 'optique auteur absente ou en double : ' + key);
        const [authored] = matchingOptics;
        const settings = Object.fromEntries(authoredSettings.map(field => [field, authored[field]]));
        demand(typeof settings.enabled === 'boolean' && authoredSettings.slice(1).every(field => Number.isFinite(settings[field])) &&
            isDeepStrictEqual(block.settings, settings) && normalizedSettings.every(field => optic[field] === settings[field]),
        'réglages de source différents de la diffusion auteur : ' + key);
        const color = normalizedColor(part, opticId);
        demand(vector(color, 255) && color.every(component => Number.isInteger(component) && component >= 0) &&
            isDeepStrictEqual(block.color, color), 'teinte de source différente : ' + key);

        const compiled = overridesByPart.get(pieceKey) ?? {};
        demand(!Object.hasOwn(compiled, opticId), 'bloc de sources en double : ' + key);
        compiled[opticId] = { ...optic, emitters: resolveEmitters(block, optic, authored, key) };
        overridesByPart.set(pieceKey, compiled);
    }
    return parts.map(part => {
        const compiled = overridesByPart.get(part.pieceKey ?? part.id);
        return compiled ? { ...part, optics: { ...part.optics, ...compiled } } : part;
    });
}

module.exports = { resolveProjectionSources };
