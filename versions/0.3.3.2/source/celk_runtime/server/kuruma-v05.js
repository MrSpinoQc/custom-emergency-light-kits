'use strict';

const { isDeepStrictEqual: same } = require('node:util');
const { sha256 } = require('./model-exports.js');
const { compileLightScenes } = require('./light-scenes.js');

const renderer = 'kuruma-optics-v1';
const id = 'kuruma-police-v05';
const version = '0.5.0';
const revision = 'DEV-01-KURUMA-POLICE-ATELIER-v05';
const mountSha256 = '3c43cbb9891eca4b9c96b2cd11efe39c99cf1d9e9a715d5ba409360b5bcfcb2d';
const palette = Object.freeze({ rouge: [255, 12, 9], bleu: [24, 72, 255], blanc: [255, 255, 255], jaune: [255, 208, 34] });
const countByPart = [10, 3, 3, 2, 2, 3, 3];
const suffix = { rouge: 'r', bleu: 'b', blanc: 'w', jaune: 'y' };

function check(condition, detail) {
    if (!condition) throw new Error('Kuruma V05 : ' + detail);
}

function fields(value, names) {
    return value && Object.getPrototypeOf(value) === Object.prototype &&
        Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}

function tuple(value, limit) {
    return Array.isArray(value) && value.length === 3 &&
        value.every(n => Number.isFinite(n) && Math.abs(n) <= limit);
}

function readParts(descriptor, reserve) {
    check(descriptor.id === id && descriptor.packVersion === version && descriptor.studioRevision === revision &&
        descriptor.author === 'Spino' && same(descriptor.palette, palette) &&
        Array.isArray(descriptor.parts) && descriptor.parts.length === countByPart.length, 'identité ou palette invalide');
    const parts = new Map();
    descriptor.parts.forEach((part, index) => {
        const n = String(index + 1).padStart(2, '0');
        check(fields(part, ['pieceKey', 'model', 'position', 'rotation', 'optics']) && part.pieceKey === `kuruma-${n}` &&
            part.model === `ta01_kuruma_${n}_v04` && tuple(part.position, 6) && tuple(part.rotation, 180) &&
            Array.isArray(part.optics) && part.optics.length === countByPart[index], 'pièce invalide : ' + n);
        reserve(part.model);
        part.optics.forEach((optic, i) => {
            const group = String(i + 1).padStart(2, '0');
            check(fields(optic, ['id', 'base', 'variants']) && optic.id === `group:${i + 1}` &&
                Object.hasOwn(palette, optic.base) && fields(optic.variants, Object.keys(palette)), 'optique invalide : ' + part.pieceKey);
            for (const [color, model] of Object.entries(optic.variants)) {
                check(model === `ta01_kuruma_${n}_g${group}_${suffix[color]}`, 'émissif incorrect : ' + part.pieceKey + '/' + optic.id);
                reserve(model);
            }
        });
        parts.set(part.pieceKey, part);
    });
    return parts;
}

const vec = ([x, y, z]) => ({ x, y, z });

function compileMount({ bytes, doc, model, service, packs }) {
    check(model === 'kuruma' && service === 'police' && packs.length === 1 && packs[0].renderer === renderer &&
        sha256(bytes) === mountSha256, 'ce banc requiert l’export Atelier qualifié et le pack exact');
    check(doc?.project?.vehicle === model && doc.project.attachments?.length === countByPart.length &&
        same(doc.axes, { space: 'vehicle', position: 'metres', rotation: 'degrees', eulerOrder: 'ZXY', up: '+Z', forward: '+Y' }),
    'modèle ou repère différent de la remise');
    const approved = new Map();
    const parts = doc.project.attachments.map(attachment => {
        const descriptor = packs[0].parts.get(attachment.key);
        check(descriptor && !approved.has(attachment.key), 'pièce inconnue ou répétée');
        approved.set(attachment.key, {
            id: attachment.key, model: descriptor.model, position: descriptor.position, rotation: descriptor.rotation,
            optics: new Set(descriptor.optics.map(optic => optic.id)), projection: new Set(),
            colors: new Map(descriptor.optics.map(optic => [optic.id, new Set(Object.keys(optic.variants))])),
        });
        return { id: attachment.key, slot: attachment.key, kind: renderer, model: descriptor.model,
            position: vec(descriptor.position), rotation: vec(descriptor.rotation), optics: descriptor.optics };
    });
    const library = compileLightScenes(bytes.toString('utf8'), model, approved);
    const special = library.byId.get('kuruma-v05-controle-multi-led');
    check(special?.durationMs === 2500 && special.tracks.length === 4, 'scène de contrôle différente');

    // This control is exclusive to the private build. Only colorId varies between the two trials.
    const comparisonId = 'kuruma-v05-banc-teinte-fixe';
    library.choices.push({ id: comparisonId, name: 'Banc · Quatre carrés, teintes fixes' });
    library.byId.set(comparisonId, { ...special, tracks: special.tracks.map(track => ({
        ...track, clips: track.clips.map(({ colorId, ...clip }) => clip),
    })) });
    return { parts, renderedParts: parts, library };
}

module.exports = { renderer, id, version, revision, palette, mountSha256, readParts, compileMount };
