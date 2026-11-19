'use strict';

const { isDeepStrictEqual: same } = require('node:util');
const { sha256 } = require('./model-exports.js');
const { expectedDiffusionAxis } = require('./diffusion-axis.js');
const { compileLightScenes } = require('./light-scenes.js');
const { attachProjectionProfiles } = require('./projection-import.js');
const studio = require('./airport-bus-v05-studio.json');
const profile = require('./profil-moteur-centre-v2.json');

const renderer = 'airport-bus-optics-v1';
const id = 'airport-bus-police-v05';
const version = '0.5.0';
const revision = studio.revision;
const vector = ([x, y, z]) => ({ x, y, z });
const axes = { space: 'vehicle', position: 'metres', rotation: 'degrees', eulerOrder: 'ZXY', up: '+Z', forward: '+Y' };
const diffusionUnits = { space: 'part-mount-pivot', position: 'm', range: 'm', opening: 'deg', intensity: 'relative', falloff: 'relative' };

function check(condition, message) {
    if (!condition) throw new Error('Airport Bus V05 : ' + message);
}

const plain = value => value && Object.getPrototypeOf(value) === Object.prototype;
const allowed = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const emptyList = value => value === undefined || (Array.isArray(value) && value.length === 0);
const emptyEditorMounts = value => value === undefined || (plain(value) && Object.keys(value).length <= 128 &&
    Object.values(value).every(other => allowed(other, ['name', 'attachments', 'layers']) &&
        typeof other.name === 'string' && emptyList(other.attachments) && emptyList(other.layers)));
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const tuple = (coord, limit) => Array.isArray(coord) && coord.length === 3 && coord.every((n, index) => finite(n, -limit[index], limit[index]));
const near = (a, b) => a.every((n, index) => Math.abs(n - b[index]) < 1e-6);
const zero = [0, 0, 0];
const authorKeys = ['enabled', 'rangeM', 'openingDeg', 'intensity', 'falloff', 'yawDeg', 'pitchDeg', 'originOffsetM'];
const patternId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

function approvedAssetManifest() {
    return { schema: 'tryagain.piece-pack', version: 2, id, packVersion: version, author: 'Spino',
        studioRevision: revision, renderer, files: studio.files };
}

function validateManifest(descriptor) {
    check(same(descriptor, approvedAssetManifest()), 'inventaire, révision ou identifiant Studio différent');
}

function indexBlocks(rows, attachments) {
    check(Array.isArray(rows) && rows.length <= attachments.length, 'liste diffusionsLentilles absente ou trop longue');
    const blocks = new Map();
    for (const block of rows) {
        check(allowed(block, ['schema', 'version', 'pieceKey', 'model', 'revision', 'units', 'optics']) &&
            block.schema === 'tryagain.lens-diffusion' && block.version === 1 && block.revision === revision &&
            same(block.units, diffusionUnits) && Object.hasOwn(studio.parts, block.pieceKey) && !blocks.has(block.pieceKey) &&
            Array.isArray(block.optics) && block.optics.length >= 1 && block.optics.length <= 6,
        'bloc de diffusion, révision, unités ou clé invalide');
        blocks.set(block.pieceKey, block);
    }
    return blocks;
}

function normalizeAuthor(author, context) {
    check(allowed(author, authorKeys) && typeof author.enabled === 'boolean' && finite(author.rangeM, 0, 60) &&
        finite(author.openingDeg, 1, 179.999999) && finite(author.intensity, 0, 20) && finite(author.falloff, 0, 100) &&
        finite(author.yawDeg ?? 0, -180, 180) && finite(author.pitchDeg ?? 0, -90, 90) &&
        tuple(author.originOffsetM ?? zero, [2, 2, 2]), 'réglage hors domaine : ' + context);
    return { ...author, yawDeg: author.yawDeg ?? 0, pitchDeg: author.pitchDeg ?? 0, originOffsetM: author.originOffsetM ?? zero };
}

function readOptics(item, block) {
    const registered = studio.optics[item.model];
    const authored = item.lensDiffusion ?? {};
    check(plain(authored) && (!block || block.model === item.model), 'modèle de diffusion différent : ' + item.key);
    const optics = new Map();
    for (const row of block?.optics ?? []) {
        const reference = registered.find(optic => optic.group === row?.id);
        check(reference && !optics.has(row.id), 'diffusion inconnue ou répétée : ' + item.key);
        const { id: opticId, emitters, ...settings } = row;
        const context = item.key + '/' + opticId;
        const author = normalizeAuthor(settings, context);
        check(Object.hasOwn(authored, opticId) && same(author, normalizeAuthor(authored[opticId], context)),
            'réglages Atelier et export divergents : ' + context);
        check(Array.isArray(emitters) && emitters.length === 1, 'une source Studio attendue : ' + context);
        const [source] = emitters;
        check(allowed(source, ['origin', 'axis']) && tuple(source.origin, [6, 6, 6]) && tuple(source.axis, [1.00001, 1.00001, 1.00001]) &&
            Math.abs(Math.hypot(...source.axis) - 1) <= .00001 &&
            near(source.origin, reference.origin.map((n, i) => n + author.originOffsetM[i])) &&
            near(source.axis, expectedDiffusionAxis(reference.axis, author.yawDeg, author.pitchDeg)),
        'origine ou axe local exporté incompatible : ' + context);
        // Atelier has already applied the author's offset and rotation to these vectors.
        optics.set(opticId, { ...author, emitters: [source], rgb: reference.rgb });
    }
    check(Object.keys(authored).every(key => optics.has(key)), 'réglage éditable sans source exportée : ' + item.key);
    return optics;
}

function indexAnimations(rows, attachments) {
    check(Array.isArray(rows) && rows.length <= attachments.length, 'bibliothèque de motifs invalide');
    const result = new Map();
    for (const block of rows) {
        check(allowed(block, ['schema', 'version', 'pieceKey', 'model', 'service', 'activeId', 'patterns', 'optics',
            'sideWhite', 'mountPivot', 'revision']) && block.schema === 'tryagain.light-patterns' && block.version === 1 &&
            block.revision === revision && block.service === 'police' && Object.hasOwn(studio.parts, block.pieceKey) &&
            !result.has(block.pieceKey), 'motif, version ou clé inconnue');
        result.set(block.pieceKey, block);
    }
    return result;
}

function readOriginalPattern(item, block) {
    if (!block && item.lightLab === undefined) return;
    const registered = studio.optics[item.model];
    const context = item.key;
    check(block && allowed(item.lightLab, ['activeId', 'patterns']) && item.model !== 'ta01_ab_scene' &&
        block.model === item.model && emptyList(block.sideWhite) && same(block.mountPivot, zero) &&
        patternId(block.activeId) && block.activeId === item.lightLab.activeId && same(block.patterns, item.lightLab.patterns) &&
        Array.isArray(block.patterns) && block.patterns.length > 0 && block.patterns.length <= 64 &&
        Array.isArray(block.optics) && block.optics.length === registered.length, 'motifs Atelier et export divergents : ' + context);
    block.optics.forEach((optic, i) => {
        const reference = registered[i];
        const face = optic?.faces?.[0];
        check(allowed(optic, ['id', 'color', 'emitters', 'faces']) && optic.id === i + 1 && same(optic.color, reference.rgb) &&
            Array.isArray(optic.emitters) && optic.emitters.length === 1 && tuple(optic.emitters[0], [6, 6, 6]) &&
            near(optic.emitters[0], reference.origin) && Array.isArray(optic.faces) && optic.faces.length === 1 &&
            allowed(face, ['position', 'direction']) && tuple(face.position, [6, 6, 6]) &&
            near(face.position, reference.origin) && tuple(face.direction, [1.00001, 1.00001, 1.00001]) &&
            near(face.direction, reference.axis), 'optique de motif différente de Studio : ' + context);
    });
    const ids = new Set();
    let original;
    for (const pattern of block.patterns) {
        check(allowed(pattern, ['id', 'name', 'steps', 'groups']) && patternId(pattern.id) && !ids.has(pattern.id) &&
            typeof pattern.name === 'string' && pattern.name.length > 0 && pattern.name.length <= 120 &&
            Array.isArray(pattern.steps) && pattern.steps.length > 0 && pattern.steps.length <= 32 &&
            Array.isArray(pattern.groups) && pattern.groups.length === registered.length, 'motif non pris en charge : ' + context);
        ids.add(pattern.id);
        // These legacy motif values are validated and preserved in the export. Lens diffusion is authoritative.
        pattern.groups.forEach((group, i) => check(allowed(group, ['id', 'direction', 'range', 'angle', 'power']) &&
            group.id === i + 1 && tuple(group.direction, [1.00001, 1.00001, 1.00001]) &&
            Math.abs(Math.hypot(...group.direction) - 1) <= .00001 && finite(group.range, 0, 60) &&
            finite(group.angle, 0, 180) && finite(group.power, 0, 20), 'groupe de motif invalide : ' + context));
        let period = 0;
        for (const step of pattern.steps) {
            check(allowed(step, ['duration', 'levels']) && Number.isInteger(step.duration) && finite(step.duration, 40, 5000) &&
                Array.isArray(step.levels) && step.levels.length === registered.length &&
                step.levels.every(value => finite(value, 0, 100)), 'phase de motif invalide : ' + context);
            period += step.duration;
        }
        check(period <= 30000, 'boucle de motif trop longue : ' + context);
        if (pattern.id === block.activeId) original = { period, steps: pattern.steps };
    }
    check(original, 'motif actif absent : ' + context);
    return original;
}

function compileMount({ bytes, doc, model, service, packs }) {
    check(model === 'airbus' && service === 'police' && packs.length === 1 && packs[0].renderer === renderer,
        'le montage nécessite le profil natif Airport Bus V05 Police');
    check(allowed(doc, ['schema', 'version', 'project', 'axes', 'preview', 'optionsGta', 'catalogueMecano',
        'projecteurs', 'timelineLumiere', 'scenesLumieres', 'diffusionsLentilles', 'animationsLumieres']) &&
        doc.schema === 'tryagain.vehicle-mount' && doc.version === 1 && same(doc.axes, axes) &&
        allowed(doc.project, ['name', 'vehicle', 'attachments', 'layers', 'mounts', 'vehicleSettings', 'lightScenes', 'lightTimeline']) &&
        doc.project.vehicle === model && emptyList(doc.project.layers) && emptyEditorMounts(doc.project.mounts) &&
        allowed(doc.project.vehicleSettings ?? {}, []) && emptyList(doc.projecteurs) &&
        (!doc.optionsGta || (allowed(doc.optionsGta, ['vehicule', 'livree', 'livreeGta', 'pieces']) && doc.optionsGta.vehicule === model &&
            doc.optionsGta.livree == null && doc.optionsGta.livreeGta == null && emptyList(doc.optionsGta.pieces))),
    'schéma, repère, couche ou équipement GTA incompatible');
    const { attachments } = doc.project;
    check(Array.isArray(attachments) && attachments.length > 0 && attachments.length <= 20, '1 à 20 accessoires attendus');
    check(doc.scenesLumieres?.version === 1 && (doc.timelineLumiere === undefined || doc.timelineLumiere.version === 1),
        'scènes v1 à teintes fixes attendues');
    const blocks = indexBlocks(doc.diffusionsLentilles ?? [], attachments);
    const animations = indexAnimations(doc.animationsLumieres ?? [], attachments);
    const approved = new Map();
    const parts = attachments.map(item => {
        check(allowed(item, ['key', 'model', 'position', 'rotation', 'lensDiffusion', 'lightLab']) &&
            Object.hasOwn(studio.parts, item.key) && studio.parts[item.key] === item.model && !approved.has(item.key) &&
            tuple(item.position, [4, 12, 5]) && tuple(item.rotation, [180, 180, 180]), 'clé, modèle ou pose hors contrat');
        const id = item.key.toLowerCase();
        const optics = readOptics(item, blocks.get(item.key));
        blocks.delete(item.key);
        const original = readOriginalPattern(item, animations.get(item.key));
        animations.delete(item.key);
        const fixed = item.model === 'ta01_ab_scene';
        const groups = new Set(fixed ? [] : studio.optics[item.model].map(row => row.group));
        approved.set(item.key, { id, model: item.model, position: item.position, rotation: item.rotation, optics: groups,
            projection: new Set() });
        const name = fixed ? `Projecteur blanc ${item.position[1] >= 0 ? 'avant' : 'arrière'} ${item.position[0] < 0 ? 'gauche' : 'droit'}` : id;
        return { id, sourceKey: item.key, slot: id, name, kind: renderer, model: item.model, position: vector(item.position),
            rotation: vector(item.rotation), optics: Object.fromEntries(optics),
            ...(original ? { original } : {}),
            ...(fixed ? { projector: { on: false, yaw: 0, pitch: 0, yawMin: 0, yawMax: 0, pitchMin: 0, pitchMax: 0 } } : {}),
        };
    });
    check(!blocks.size && !animations.size, 'bloc de diffusion ou motif pour une pièce absente');
    const library = compileLightScenes(bytes.toString('utf8'), model, approved);
    const converted = attachProjectionProfiles(parts, { profile, exportSha256: sha256(bytes) });
    const renderedParts = converted.map(part => ({ ...part, optics: studio.optics[part.model].map(optic => ({
        id: optic.group, model: optic.drawable, rgb: optic.rgb, ...(part.optics[optic.group] ? { diffusion: part.optics[optic.group] } : {}),
    })) }));
    return { parts, renderedParts, library };
}

module.exports = { renderer, id, version, revision, approvedAssetManifest, validateManifest, compileMount };
