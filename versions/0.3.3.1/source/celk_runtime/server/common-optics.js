'use strict';

const { isDeepStrictEqual: same } = require('node:util');
const { sha256 } = require('./model-exports.js');
const { expectedDiffusionAxis } = require('./diffusion-axis.js');
const { compileLightScenes } = require('./light-scenes.js');
const { attachProjectionProfiles } = require('./projection-import.js');
const { maxAccessoriesPerVehicle } = require('../installation-limits.json');
const profile = require('./profil-moteur-centre-v2.json');

const renderer = 'celk-optics-v1';
const versions = Object.freeze({ fixedBodies: 1, opticPalettes: 1, lightScenes: 2, piecePatterns: 1,
    lensDiffusion: 1, fixedProjectors: 1, articulatedProjectors: 1 });
const axes = { space: 'vehicle', position: 'metres', rotation: 'degrees', eulerOrder: 'ZXY', up: '+Z', forward: '+Y' };
const units = { space: 'part-mount-pivot', position: 'm', range: 'm', opening: 'deg', intensity: 'relative', falloff: 'relative' };
const authorKeys = ['enabled', 'rangeM', 'openingDeg', 'intensity', 'falloff', 'originOffsetM', 'yawDeg', 'pitchDeg'];
const opticId = /^group:[1-9][0-9]?$/;
const tintId = /^[a-z][a-z0-9-]{0,31}$/;
const pieceId = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const plain = value => value != null && Object.getPrototypeOf(value) === Object.prototype;
const accepts = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const fields = (value, keys) => accepts(value, keys) && Object.keys(value).length === keys.length;
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const integer = (n, min, max) => Number.isInteger(n) && finite(n, min, max);
const list = (value, min, max) => Array.isArray(value) && value.length >= min && value.length <= max;
const triple = (value, bound) => list(value, 3, 3) && value.every(n => finite(n, -bound, bound));
const axis = value => triple(value, 1.00001) && Math.abs(Math.hypot(...value) - 1) <= .00001;
const rgb = value => list(value, 3, 3) && value.every(n => integer(n, 0, 255));
const near = (a, b) => a.every((n, index) => Math.abs(n - b[index]) < .000001);
const vec = ([x, y, z]) => ({ x, y, z });

function check(condition, message) {
    if (!condition) throw new Error('CELK 0.3.0 refonte · ' + message);
}

function requireCapability(capabilities, key, version = 1) {
    check(Object.hasOwn(capabilities, key) && capabilities[key] >= version, `capacité non déclarée : ${key} v${version}`);
}

function validateCapabilities(value) {
    check(plain(value), 'liste de capacités absente');
    for (const [name, version] of Object.entries(value)) {
        check(Object.hasOwn(versions, name) && integer(version, 1, versions[name]), `capacité ou version inconnue : ${name} v${version}`);
    }
    requireCapability(value, 'fixedBodies');
    requireCapability(value, 'opticPalettes');
}

function sources(value) {
    return list(value, 1, 16) && value.every(source =>
        fields(source, ['origin', 'axis']) && triple(source.origin, 6) && axis(source.axis));
}

function readProjector(row, reserve, capabilities) {
    if (row === undefined) return;
    if (fields(row, ['mode']) && row.mode === 'fixed') {
        requireCapability(capabilities, 'fixedProjectors');
        return { mode: 'fixed', on: false, yaw: 0, pitch: 0, yawMin: 0, yawMax: 0, pitchMin: 0, pitchMax: 0 };
    }
    requireCapability(capabilities, 'articulatedProjectors');
    check(fields(row, ['mode', 'fork', 'head', 'yawPivot', 'pitchPivot', 'yawMin', 'yawMax', 'pitchMin', 'pitchMax']) &&
        row.mode === 'articulated' && triple(row.yawPivot, 6) && triple(row.pitchPivot, 6) &&
        finite(row.yawMin, -180, 0) && finite(row.yawMax, 0, 180) && finite(row.pitchMin, -90, 0) &&
        finite(row.pitchMax, 0, 90) && (row.yawMin < row.yawMax || row.pitchMin < row.pitchMax),
    'articulation ou butées invalides');
    reserve(row.fork);
    reserve(row.head);
    return { ...row, yawPivot: vec(row.yawPivot), pitchPivot: vec(row.pitchPivot), on: false, yaw: 0, pitch: 0 };
}

function readParts(descriptor, reserve) {
    const { capabilities, parts } = descriptor;
    validateCapabilities(capabilities);
    const result = new Map();
    for (const row of parts) {
        check(accepts(row, ['model', 'optics', 'projector']) && list(row.optics, 1, 16), 'corps ou liste d’optiques invalide');
        reserve(row.model);
        const projector = readProjector(row.projector, reserve, capabilities);
        check(!projector || row.optics.length === 1, 'un projecteur doit porter une optique');
        const optics = new Map();
        for (const optic of row.optics) {
            check(accepts(optic, ['id', 'base', 'palette', 'emitters']) && typeof optic.id === 'string' && opticId.test(optic.id) &&
                !optics.has(optic.id) && plain(optic.palette) && typeof optic.base === 'string' &&
                Object.hasOwn(optic.palette, optic.base), 'optique ou base de palette invalide sur ' + row.model);
            const palette = Object.entries(optic.palette);
            check(palette.length >= 1 && palette.length <= 8, 'palette hors limite pour ' + optic.id);
            for (const [id, variant] of palette) {
                check(tintId.test(id) && fields(variant, ['model', 'rgb']) && rgb(variant.rgb), 'teinte invalide : ' + optic.id + '/' + id);
                reserve(variant.model);
            }
            if (optic.emitters !== undefined) {
                requireCapability(capabilities, 'lensDiffusion');
                check(sources(optic.emitters), 'repères Studio invalides : ' + optic.id);
            }
            optics.set(optic.id, optic);
        }
        result.set(row.model, { optics, projector });
    }
    return result;
}

function readPattern(pattern, optics, part, capabilities) {
    if (pattern === undefined) return;
    requireCapability(capabilities, 'piecePatterns');
    check(!part.projector && fields(pattern, ['steps']) && list(pattern.steps, 1, 32), 'motif invalide : ' + part.id);
    let period = 0;
    const steps = pattern.steps.map(step => {
        check(fields(step, ['duration', 'levels']) && integer(step.duration, 40, 5000) && plain(step.levels) &&
            Object.entries(step.levels).every(([id, level]) => optics.has(id) && integer(level, 0, 100)),
        'pas de motif invalide : ' + part.id);
        period += step.duration;
        return { duration: step.duration, levels: [...optics.keys()].map(id => step.levels[id] ?? 0) };
    });
    check(period <= 30000, 'motif de plus de 30 s : ' + part.id);
    return { period, steps };
}

function indexedDiffusions(doc, count) {
    const rows = doc.diffusionsLentilles === undefined ? [] : doc.diffusionsLentilles;
    check(list(rows, 0, count), 'liste de diffusions invalide');
    const map = new Map();
    for (const row of rows) {
        check(fields(row, ['schema', 'version', 'pieceKey', 'model', 'revision', 'units', 'optics']) &&
            row.schema === 'tryagain.lens-diffusion' && row.version === 1 && same(row.units, units) &&
            typeof row.pieceKey === 'string' && !map.has(row.pieceKey) && list(row.optics, 1, 16),
        'bloc de diffusion incompatible : ' + row?.pieceKey);
        map.set(row.pieceKey, row);
    }
    return map;
}

function readAuthor(row, context) {
    check(accepts(row, authorKeys) && typeof row.enabled === 'boolean' && finite(row.rangeM, 0, 60) &&
        finite(row.openingDeg, 1, 179.999999) && finite(row.intensity, 0, 20) && finite(row.falloff, 0, 100) &&
        finite(row.yawDeg ?? 0, -180, 180) && finite(row.pitchDeg ?? 0, -90, 90) && triple(row.originOffsetM ?? [0, 0, 0], 2),
    'réglages de diffusion invalides : ' + context);
    return { ...row, yawDeg: row.yawDeg ?? 0, pitchDeg: row.pitchDeg ?? 0, originOffsetM: row.originOffsetM ?? [0, 0, 0] };
}

function readDiffusions(item, row, optics, pack) {
    const authored = item.lensDiffusion ?? {};
    const result = new Map();
    check(plain(authored) && (!row || (row.model === item.model && row.revision === pack.studioRevision)),
        'diffusion ou révision Studio divergente : ' + item.key);
    if (row) requireCapability(pack.capabilities, 'lensDiffusion');
    for (const entry of row?.optics ?? []) {
        check(plain(entry), 'optique de diffusion invalide : ' + item.key);
        const { id, emitters, ...values } = entry;
        const reference = optics.get(id)?.emitters;
        const context = item.key + '/' + id;
        check(reference && !result.has(id) && Object.hasOwn(authored, id) && sources(emitters) && reference.length === emitters.length,
            'optique, empreinte de pose ou nombre de sources invalide : ' + context);
        const author = readAuthor(values, context);
        check(same(author, readAuthor(authored[id], context)), 'diffusions Atelier et export divergentes : ' + context);
        for (const [i, emitter] of emitters.entries()) {
            check(near(emitter.origin, reference[i].origin.map((n, j) => n + author.originOffsetM[j])) &&
                near(emitter.axis, expectedDiffusionAxis(reference[i].axis, author.yawDeg, author.pitchDeg)),
            'repère de diffusion divergent : ' + context);
        }
        result.set(id, { ...author, emitters });
    }
    check(Object.keys(authored).every(id => result.has(id)), 'diffusion éditée sans source exportée : ' + item.key);
    return result;
}

function editorModelMap(value) {
    if (!plain(value)) return false;
    const entries = Object.entries(value);
    return entries.length <= 1000 && entries.every(([id, row]) => pieceId.test(id) && plain(row));
}

function neutralVehicleSettings(settings) {
    return accepts(settings, ['livery', 'visibility', 'transforms', 'mods']) &&
        settings.livery == null && ['visibility', 'transforms', 'mods'].every(key =>
            settings[key] === undefined || fields(settings[key], []));
}

function neutralNativePart(row) {
    return accepts(row, ['id', 'nom', 'type', 'extra', 'kit', 'index', 'categorie', 'source', 'visible', 'origine', 'position', 'rotation']) &&
        row.type === 'stock' && row.visible === true && row.extra == null && row.kit == null && row.index == null &&
        Array.isArray(row.origine) && row.origine.length === 3 && row.origine.every(Number.isFinite) &&
        same(row.position, row.origine) && same(row.rotation, [0, 0, 0]);
}

function validateEditorEnvelope(doc, model) {
    const { project, projecteurs, optionsGta, catalogueMecano } = doc;
    check(project.layers === undefined || list(project.layers, 0, 0), 'couches de livrée actives non prises en charge');
    check(projecteurs === undefined || list(projecteurs, 0, 0), 'déclaration de projecteur historique non prise en charge dans le pack v3');
    // Drafts, progress, previews and catalogue rows stay in the sealed source. They never supply assets or active poses.
    check(project.mounts === undefined || (editorModelMap(project.mounts) && !Object.hasOwn(project.mounts, model)),
        'brouillons Atelier invalides ou seconde définition du véhicule actif');
    if (project.vehicleProgress !== undefined) {
        check(plain(project.vehicleProgress) && Object.keys(project.vehicleProgress).length <= 1000 &&
            Object.entries(project.vehicleProgress).every(([id, state]) =>
                pieceId.test(id) && (state === 'editing' || state === 'done')), 'progression Atelier invalide');
    }
    if (project.vehicleSettings !== undefined) {
        check(editorModelMap(project.vehicleSettings), 'réglages des véhicules invalides');
        if (Object.hasOwn(project.vehicleSettings, model)) {
            check(neutralVehicleSettings(project.vehicleSettings[model]), 'modification GTA active dans vehicleSettings');
        }
    }
    if (catalogueMecano !== undefined) {
        check(accepts(catalogueMecano, ['vehicule', 'pieces']) && catalogueMecano.vehicule === model &&
            list(catalogueMecano.pieces, 0, 512) && catalogueMecano.pieces.every(plain), 'catalogue mécano déclaratif incompatible');
    }
    if (optionsGta !== undefined) {
        check(accepts(optionsGta, ['vehicule', 'livree', 'livreeGta', 'pieces']) && optionsGta.vehicule === model &&
            optionsGta.livree == null && optionsGta.livreeGta == null && list(optionsGta.pieces, 0, 512) &&
            optionsGta.pieces.every(neutralNativePart), 'options GTA actives ou non reconnues');
    }
}

function compileMount({ bytes, doc, model, packs }) {
    check(accepts(doc, ['schema', 'version', 'project', 'axes', 'scenesLumieres', 'timelineLumiere', 'diffusionsLentilles', 'preview',
        'optionsGta', 'catalogueMecano', 'projecteurs']) &&
        doc.schema === 'tryagain.vehicle-mount' && doc.version === 1 && same(doc.axes, axes) &&
        accepts(doc.project, ['name', 'vehicle', 'attachments', 'lightScenes', 'lightTimeline', 'layers', 'mounts',
            'vehicleProgress', 'vehicleSettings']) && doc.project.vehicle === model &&
        list(doc.project.attachments, 1, maxAccessoriesPerVehicle), 'montage, repère ou fonctionnalités hors contrat');
    validateEditorEnvelope(doc, model);
    const ownership = new Map(), used = new Set(), approved = new Map();
    for (const pack of packs) for (const [name, part] of pack.parts) {
        check(!ownership.has(name), 'modèle d’accessoire fourni par deux packs : ' + name);
        ownership.set(name, { pack, part });
    }
    const declaredDiffusions = indexedDiffusions(doc, doc.project.attachments.length);
    const traits = new Map(), templateOptics = new Map();
    const parts = doc.project.attachments.map(item => {
        check(accepts(item, ['key', 'model', 'position', 'rotation', 'colors', 'opticPattern', 'lensDiffusion']) &&
            typeof item.key === 'string' && pieceId.test(item.key) && !approved.has(item.key) &&
            ownership.has(item.model) && triple(item.position, 12) && triple(item.rotation, 180),
        'clé, modèle ou pose invalide : ' + item?.key);
        const { pack, part: template } = ownership.get(item.model);
        used.add(pack.id);
        traits.set(item.key, pack.capabilities);
        const { optics, projector } = template;
        const colors = item.colors ?? {};
        check(plain(colors) && Object.entries(colors).every(([id, color]) =>
            typeof color === 'string' && optics.has(id) && Object.hasOwn(optics.get(id).palette, color)),
        'teinte non présente au catalogue : ' + item.key);
        const optical = [...optics.values()].map(optic => ({ id: optic.id, base: colors[optic.id] ?? optic.base, palette: optic.palette }));
        templateOptics.set(item.key, optical);
        const diffusions = readDiffusions(item, declaredDiffusions.get(item.key), optics, pack);
        declaredDiffusions.delete(item.key);
        const projection = {};
        for (const optic of optical) if (diffusions.has(optic.id)) projection[optic.id] = {
            ...diffusions.get(optic.id), rgb: optic.palette[optic.base].rgb,
        };
        approved.set(item.key, { id: item.key, model: item.model, position: item.position, rotation: item.rotation,
            optics: new Set(projector ? [] : optics.keys()), projection: new Set(diffusions.keys()),
            colors: new Map(optical.map(optic => [optic.id, new Set(Object.keys(optic.palette))])) });
        const part = { id: item.key, slot: item.key, name: item.key, kind: renderer, model: item.model,
            position: vec(item.position), rotation: vec(item.rotation), optics: projection };
        if (projector) part.projector = projector;
        const original = readPattern(item.opticPattern, optics, part, pack.capabilities);
        if (original) part.original = original;
        return part;
    });
    check(!declaredDiffusions.size && used.size === packs.length, 'diffusion orpheline ou dépendance superflue');
    const hasScenes = doc.scenesLumieres !== undefined || doc.timelineLumiere !== undefined ||
        doc.project.lightScenes !== undefined || doc.project.lightTimeline !== undefined;
    const library = hasScenes ? compileLightScenes(bytes.toString('utf8'), model, approved)
        : { defaultId: null, choices: [], byId: new Map() };
    if (hasScenes) {
        const version = doc.scenesLumieres?.version ?? doc.timelineLumiere?.version ?? doc.project.lightTimeline?.version ?? 1;
        check(integer(version, 1, versions.lightScenes) && [...traits.values()].some(caps => caps.lightScenes >= version),
            'version inconnue ou capacité non déclarée : lightScenes');
        for (const timeline of library.byId.values()) for (const track of timeline.tracks) {
            requireCapability(traits.get(track.pieceKey), 'lightScenes', timeline.version);
        }
    }
    const projected = attachProjectionProfiles(parts, { profile, exportSha256: sha256(bytes) });
    const renderedParts = projected.map(part => ({ ...part, optics: templateOptics.get(part.id).map(optic => ({
        ...optic, ...(part.optics[optic.id] ? { diffusion: part.optics[optic.id] } : {}),
    })) }));
    return { parts: renderedParts, renderedParts, library };
}

function fromLegacy(renderedParts, family, legacyPalette) {
    return renderedParts.map(part => {
        const { id: partId, slot, name = partId, model, position, rotation } = part;
        const common = { id: partId, slot, name, model, position, rotation, kind: renderer };
        if (family === 'phantom') {
            const [zone] = part.zones;
            const { r, g, b, id = r === 255 ? 'rouge' : 'bleu' } = zone.color;
            const diffusion = part.optics?.['group:1'];
            return { ...common, optics: [{ id: 'group:1', base: id,
                palette: { [id]: { model: zone.model, rgb: [r, g, b] } }, ...(diffusion ? { diffusion } : {}) }],
                original: { steps: part.ghostSteps, period: part.ghostSteps.reduce((sum, step) => sum + step.duration, 0) },
                fallbackInScene: true };
        }
        const optics = part.optics.map(optic => {
            if (family === 'kuruma') return { id: optic.id, base: optic.base, palette: Object.fromEntries(
                Object.entries(optic.variants).map(([name, model]) => [name, { model, rgb: legacyPalette[name] }])) };
            return { id: optic.id, base: 'fixe', palette: { fixe: { model: optic.model, rgb: optic.rgb } },
                ...(optic.diffusion ? { diffusion: optic.diffusion } : {}) };
        });
        return { ...common, ...(part.sourceKey ? { sourceKey: part.sourceKey } : {}), optics,
            ...(part.projector ? { projector: { ...part.projector, mode: 'fixed' } } : {}),
            ...(part.original ? { original: part.original } : {}) };
    });
}

module.exports = { renderer, versions, readParts, compileMount, fromLegacy };
