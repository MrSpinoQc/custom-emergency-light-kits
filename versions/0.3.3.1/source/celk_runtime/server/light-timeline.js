'use strict';

const { isDeepStrictEqual } = require('node:util');
const schema = 'tryagain.light-timeline';
const format = /^(?:group:[1-9][0-9]{0,5}|side:(?:0|[1-9][0-9]{0,5})|discrete|spotlight|scene:[a-zA-Z0-9_-]{1,64})$/;
const pieceId = /^[a-zA-Z0-9_-]{1,64}$/;
const isProjectorOptic = id => id === 'spotlight' || id.startsWith('scene:');

function check(condition, message) {
    if (!condition) throw new Error('Frise : ' + message);
}

function record(value, fields) {
    return value && Object.getPrototypeOf(value) === Object.prototype &&
        Object.keys(value).every(key => fields.includes(key));
}

function dense(value, maximum) {
    return Array.isArray(value) && value.length <= maximum &&
        Object.keys(value).length === value.length && Array.from(value).every((_, i) => Object.hasOwn(value, i));
}

const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

function normalize(raw, registry, colorAllowed = () => false) {
    check(record(raw, ['schema', 'version', 'durationMs', 'enabled', 'loop', 'tracks']) &&
        raw.schema === schema && (raw.version === 1 || raw.version === 2), 'schéma/version non pris en charge');
    const { version, durationMs, enabled, loop, tracks } = raw;
    check(integer(durationMs, 1, 300000) && typeof enabled === 'boolean' && typeof loop === 'boolean',
        'durée, activation ou boucle invalide');
    check(dense(tracks, 160), 'liste de pistes invalide');
    const seen = new Map();
    let count = 0;
    const normalized = tracks.map(track => {
        check(record(track, ['pieceKey', 'opticId', 'clips']), 'piste invalide');
        const { pieceKey, opticId, clips } = track;
        check(typeof pieceKey === 'string' && pieceId.test(pieceKey) && typeof opticId === 'string' &&
            format.test(opticId) && registry.get(pieceKey)?.has(opticId), 'pièce/optique indisponible');
        if (!seen.has(pieceKey)) seen.set(pieceKey, new Set());
        check(!seen.get(pieceKey).has(opticId), 'piste en double');
        seen.get(pieceKey).add(opticId);
        check(dense(clips, 512) && (count += clips.length) <= 4096, 'trop de clips ou liste invalide');
        const ordered = clips.map(clip => {
            check(record(clip, ['startMs', 'endMs', 'level', 'projection', 'colorId']), 'clip invalide');
            const { startMs, endMs, level, projection, colorId } = clip;
            const explicit = Object.hasOwn(clip, 'projection');
            const colored = Object.hasOwn(clip, 'colorId');
            check(!colored || (version === 2 && typeof colorId === 'string' && colorAllowed(pieceKey, opticId, colorId)),
                'couleur interdite ou inconnue pour ' + pieceKey + '/' + opticId);
            check(integer(startMs, 0, durationMs - 1) && integer(endMs, startMs + 1, durationMs) &&
                integer(level, 0, 100) && (!explicit || typeof projection === 'boolean'), 'bornes, niveau ou projection invalides');
            return { startMs, endMs, level, ...(explicit ? { projection } : {}), ...(colored ? { colorId } : {}) };
        }).sort((a, b) => a.startMs - b.startMs);
        check(ordered.every((clip, i) => !i || ordered[i - 1].endMs <= clip.startMs), 'clips en chevauchement');
        return { pieceKey, opticId, clips: ordered };
    });
    return { schema, version, durationMs, enabled, loop, tracks: normalized };
}

function fromExport(doc, registry) {
    check(doc?.schema === 'tryagain.vehicle-mount' && doc.version === 1 &&
        Array.isArray(doc.project?.attachments), 'export de montage invalide');
    if (!Object.hasOwn(doc, 'timelineLumiere')) return { status: 'absent' };
    try {
        const declared = new Set();
        for (const part of doc.project.attachments) {
            check(typeof part?.key === 'string' && pieceId.test(part.key) && !declared.has(part.key) &&
                typeof part.model === 'string', 'pièce exportée invalide ou dupliquée');
            declared.add(part.key);
        }
        const modelRegistry = new Map(doc.project.attachments.map(({ key, model }) => [key, registry.get(model) ?? new Set()]));
        const result = normalize(doc.timelineLumiere, modelRegistry);
        if (Object.hasOwn(doc.project, 'lightTimeline')) {
            const editor = doc.project.lightTimeline;
            check(record(editor, ['schema', 'version', 'durationMs', 'enabled', 'loop', 'tracks']), 'copie Atelier invalide');
            check(isDeepStrictEqual(result, normalize({ schema, version: 1, ...editor }, modelRegistry)),
                'la copie Atelier diverge du bloc exporté');
        }
        return { status: result.enabled ? 'active' : 'disabled', timeline: result };
    } catch (error) {
        return { status: 'rejected', reason: error.message };
    }
}

function bind(timeline, installedIds) {
    if (!timeline?.enabled) return undefined;
    const tracks = timeline.tracks.map(track => {
        const id = installedIds.get(track.pieceKey);
        check(typeof id === 'string' && pieceId.test(id), 'pièce sans correspondance FiveM');
        return { ...track, pieceKey: id };
    });
    const keys = new Set(tracks.map(track => track.pieceKey + ':' + track.opticId));
    check(keys.size === tracks.length, 'deux pistes visent la même optique FiveM');
    return { ...timeline, tracks };
}

// The catalogue is approved before F6. Filter by installed part without moving
// the epoch when one of several tracked pieces is taken off and put back.
function forMounted(timeline, parts) {
    if (!timeline?.enabled) return undefined;
    const ids = new Set(parts.map(part => part.id));
    const tracks = timeline.tracks.filter(track => ids.has(track.pieceKey) && !isProjectorOptic(track.opticId));
    return tracks.length ? { ...timeline, tracks } : undefined;
}

module.exports = { normalize, fromExport, bind, forMounted, isProjectorOptic };
