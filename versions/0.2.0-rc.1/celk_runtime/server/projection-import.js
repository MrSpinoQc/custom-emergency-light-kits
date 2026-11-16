'use strict';

const { bindProjectionPresets, createCentreAdapter } = require('./projection-adaptation.cjs');

const groupId = /^group:[1-9]\d?$/;
const stableId = /^[a-z0-9][a-z0-9_.-]{0,63}$/i;
const sourceId = /^[a-z0-9_.:-]{1,96}$/i;
const sha256 = /^[a-f0-9]{64}$/i;
const authorBounds = { rangeM: [0, 60], intensity: [0, 20], falloff: [0, 100] };
const nativeBounds = { hardness: [0, 1], nativeSizeScale: [0.5, 32] };
const centreBounds = {
    wideOpeningThresholdDeg: [1, 179],
    wideHalfAngleFactor: [0.01, 1],
    wideMaxHalfAngleDeg: [0.01, 89.9],
    wideBrightnessWeight: [0, 1],
    narrowBrightnessWeight: [0, 1],
    exposedFaceMarginDeg: [0, 89],
};

function requireProjection(condition, message) {
    if (!condition) throw new Error('Import projection · ' + message);
}

function validateBounds(values, bounds, context) {
    for (const [field, [min, max]] of Object.entries(bounds)) {
        const value = values?.[field];
        requireProjection(Number.isFinite(value) && value >= min && value <= max, field + ' hors domaine : ' + context);
    }
}

function validateAuthor(values, context) {
    validateBounds(values, authorBounds, context);
    requireProjection(Number.isFinite(values.openingDeg) && values.openingDeg >= 1 && values.openingDeg < 180,
        'openingDeg hors domaine : ' + context);
}

function validateProfile(profile) {
    validateBounds(profile?.centre, centreBounds, 'profil moteur');
    const unassigned = profile?.unassigned;
    validateBounds(unassigned?.narrow, nativeBounds, 'profil étroit sans préréglage');
    validateBounds(unassigned?.wide, nativeBounds, 'profil large sans préréglage');
    for (const [field, [, max]] of Object.entries(authorBounds)) {
        const { target, authorAnchor } = unassigned.wide.gainRatios?.[field] ?? {};
        requireProjection(Number.isFinite(target) && target > 0 && target <= max &&
            Number.isFinite(authorAnchor) && authorAnchor > 0 && authorAnchor <= max &&
            target / authorAnchor >= 0.125 && target / authorAnchor <= 8, 'gain large hors domaine : ' + field);
    }
}

function triple(vector, bound) {
    return Array.isArray(vector) && vector.length === 3 &&
        [vector[0], vector[1], vector[2]].every(value => Number.isFinite(value) && Math.abs(value) <= bound);
}

function validatePresetRegistry(registry) {
    requireProjection(Array.isArray(registry?.presets), 'registre de préréglages manquant');
    for (const preset of registry.presets) {
        requireProjection(typeof preset?.id === 'string' && stableId.test(preset.id), 'identifiant de préréglage invalide');
        validateAuthor(preset.settings, preset.id);
        requireProjection(preset.settings.rangeM > 0, 'portée de préréglage nulle : ' + preset.id);
        validateBounds(preset.settings, nativeBounds, preset.id);
    }
}

function compileOptic(part, pieceKey, opticId, optic, options, render, selection) {
    const context = pieceKey + '/' + opticId;
    requireProjection(typeof optic?.enabled === 'boolean' && Array.isArray(optic.emitters) && optic.emitters.length <= 16,
        'optique ou nombre de sources invalide : ' + context);
    validateAuthor(optic, context);
    const zone = part.zones?.[Number(opticId.slice('group:'.length)) - 1];
    const names = new Set();
    const emitters = optic.emitters.map((emitter, index) => {
        requireProjection(triple(emitter?.origin, 6) && triple(emitter?.axis, 1.00001) &&
            Math.abs(Math.hypot(...emitter.axis) - 1) <= 0.00001, 'repère de source invalide : ' + context);
        const id = emitter.sourceId ?? emitter.id ?? 'origine-' + index;
        requireProjection(typeof id === 'string' && sourceId.test(id) && !names.has(id),
            'identifiant de source invalide ou répété : ' + context);
        names.add(id);

        const author = emitter.author ?? optic;
        validateAuthor(author, context + '/' + id);
        const authoredColor = emitter.color ?? optic.color ?? optic.rgb ?? zone?.color;
        const color = Array.isArray(authoredColor) ? authoredColor : [authoredColor?.r, authoredColor?.g, authoredColor?.b];
        requireProjection(triple(color, 255) && color.every(value => Number.isInteger(value) && value >= 0),
            'teinte de source invalide : ' + context);

        const contextNormal = options.exposedFaceNormalLocal;
        const exposedFaceNormalLocal = emitter.exposedFaceNormalLocal ?? optic.exposedFaceNormalLocal ??
            (typeof contextNormal === 'function' ? contextNormal(part, opticId, emitter) : contextNormal);
        requireProjection(exposedFaceNormalLocal === undefined ||
            (triple(exposedFaceNormalLocal, 16) && Math.hypot(...exposedFaceNormalLocal) >= 0.00001),
        'normale de face exposée invalide : ' + context);

        if (author.rangeM === 0 || author.intensity === 0) return false;
        const call = render({ pieceKey, opticId, sourceId: id, author, enabled: true, projectionKind: 'lens-diffusion',
            originLocalM: emitter.origin, axisLocal: emitter.axis, color, exposedFaceNormalLocal },
        { level: 100, projectionEnabled: true }, selection);
        if (call === null) return false;
        const { rangeM, brightness, hardness, nativeSizeArgument, falloff, halfAngleDeg, originLocalM, axisLocal } = call;
        requireProjection(Number.isFinite(nativeSizeArgument) && nativeSizeArgument >= 0 && nativeSizeArgument <= 100000 &&
            Number.isFinite(halfAngleDeg) && halfAngleDeg > 0 && halfAngleDeg <= 89.9 &&
            Number.isFinite(rangeM) && rangeM > 0 && rangeM <= 512 &&
            Number.isFinite(brightness) && brightness >= 0 && brightness <= 1000 &&
            Number.isFinite(falloff) && falloff >= 0 && falloff <= 1000,
        'appel natif hors domaine : ' + context);
        return { sourceId: id, originLocalM, axisLocal, rangeM, brightness, hardness, nativeSizeArgument, falloff, halfAngleDeg };
    });
    const preset = selection.get(JSON.stringify([pieceKey, opticId]));
    return { ...optic, nativeProjection: { version: 1, engineProfile: options.profile.id,
        ...(preset ? { presetId: preset.id } : {}), emitters } };
}

function attachProjectionProfiles(parts, options = {}) {
    const { profile, registry, bindings, exportSha256 } = options;
    requireProjection(typeof exportSha256 === 'string' && sha256.test(exportSha256), 'empreinte Atelier attendue');
    requireProjection(Array.isArray(parts), 'pièces normalisées attendues');
    validateProfile(profile);
    const render = createCentreAdapter(profile);

    if (bindings !== undefined) validatePresetRegistry(registry);
    const optics = [];
    const known = new Set();
    const partsAndOptics = parts.map(part => {
        requireProjection(part && typeof part === 'object' && !Array.isArray(part), 'pièce normalisée invalide');
        const pieceKey = part.pieceKey ?? part.id;
        const groups = Object.entries(part.optics ?? {}).filter(([id]) => groupId.test(id));
        for (const [opticId] of groups) {
            requireProjection(typeof pieceKey === 'string' && stableId.test(pieceKey), 'clé de pièce invalide');
            const key = pieceKey + '/' + opticId;
            requireProjection(!known.has(key), 'optique normalisée répétée : ' + key);
            known.add(key);
            optics.push({ pieceKey, opticId });
        }
        return { part, pieceKey, groups };
    });
    const selection = bindProjectionPresets({ profile, registry, bindings, exportSha256, optics });
    return partsAndOptics.map(({ part, pieceKey, groups }) => {
        if (!groups.length) return { ...part };
        const compiled = Object.fromEntries(groups.map(([id, optic]) =>
            [id, compileOptic(part, pieceKey, id, optic, options, render, selection)]));
        return { ...part, optics: { ...part.optics, ...compiled } };
    });
}

module.exports = { attachProjectionProfiles };
