'use strict';

const { isDeepStrictEqual: same } = require('node:util');
const { normalize, bind, isProjectorOptic } = require('./light-timeline.js');

const schema = 'tryagain.light-scenes';
const timelineSchema = 'tryagain.light-timeline';
const sceneId = /^[\w-]{1,100}$/;
const validId = id => typeof id === 'string' && sceneId.test(id);
const limitBytes = 6 * 1024 * 1024;
// Chassis poses are approval metadata. Pack saves keep the original bone-local parts.
const chassisPoses = new WeakMap();

function check(condition, reason) {
    if (!condition) throw new Error('Scènes : ' + reason);
}

function normalizeLibrary(value, opticsByKey, fromWire, version, colorAllowed) {
    check(value && typeof value === 'object' && !Array.isArray(value) &&
        (!fromWire || (value.schema === schema && value.version === version)), 'schéma incompatible');
    const { defaultId, scenes } = value;
    check((defaultId === null || validId(defaultId)) && Array.isArray(scenes) &&
        scenes.length <= 64, 'liste ou scène par défaut invalide');
    const ids = new Set();
    const clean = scenes.map(entry => {
        const { id, name, timeline } = entry ?? {};
        const title = typeof name === 'string' ? name.trim() : '';
        check(validId(id) && !ids.has(id) && title && title.length <= 64, 'identifiant ou nom de scène invalide');
        check(timeline && typeof timeline.enabled === 'boolean', 'activation de frise invalide');
        check(timeline.version === undefined || timeline.version === version, 'version de piste incompatible');
        ids.add(id);
        return { id, name: title,
            timeline: normalize({ schema: timelineSchema, version, ...timeline, enabled: id === defaultId }, opticsByKey, colorAllowed) };
    });
    check(defaultId === null || ids.has(defaultId), 'scène par défaut absente');
    return { defaultId, scenes: clean };
}

function verifyParts(doc, vehicle, approvedParts) {
    check(doc?.schema === 'tryagain.vehicle-mount' && doc.version === 1 && doc.project?.vehicle === vehicle &&
        Array.isArray(doc.project.attachments) && doc.project.attachments.length === approvedParts.size,
    'montage ou véhicule incompatible');
    const seen = new Set();
    for (const attachment of doc.project.attachments) {
        const approved = approvedParts.get(attachment?.key);
        check(approved && validId(attachment.key) && !seen.has(attachment.key) && approved.model === attachment.model &&
            same(approved.position, attachment.position) && same(approved.rotation, attachment.rotation) &&
            approved.color === attachment.ghostColor, 'clé, modèle, pose ou teinte différente du montage approuvé');
        seen.add(attachment.key);
    }
}

function compileLightScenes(contents, vehicle, approvedParts) {
    check(typeof contents === 'string' && Buffer.byteLength(contents) <= limitBytes, 'fichier trop grand ou absent');
    return compileSceneDocument(JSON.parse(contents), vehicle, approvedParts);
}

function compileSceneDocument(doc, vehicle, approvedParts) {
    verifyParts(doc, vehicle, approvedParts);
    const byKey = new Map([...approvedParts].map(([key, part]) => [key, part.optics]));
    const version = doc.scenesLumieres?.version ?? doc.timelineLumiere?.version ?? 1;
    const colorAllowed = (key, optic, color) => {
        const approved = approvedParts.get(key);
        const fixed = approved?.unlitLens?.get(optic);
        return (fixed === undefined || fixed === color) && approved?.colors?.get(optic)?.has(color) === true;
    };
    const local = doc.project.lightScenes === undefined ? null : normalizeLibrary(doc.project.lightScenes, byKey, false, version, colorAllowed);
    const wire = doc.scenesLumieres === undefined ? null : normalizeLibrary(doc.scenesLumieres, byKey, true, version, colorAllowed);
    check(!local || !wire || same(local, wire), 'copie Atelier différente de la bibliothèque exportée');
    check(local?.scenes.length !== 0 || wire?.scenes.length === 0, 'bibliothèque vide non déclarée dans l’export');

    check(doc.timelineLumiere === undefined || doc.timelineLumiere.version === version, 'version de frise incompatible');
    const timeline = doc.timelineLumiere === undefined ? null : normalize(doc.timelineLumiere, byKey, colorAllowed);
    const storedTimeline = doc.project.lightTimeline;
    check(storedTimeline?.version === undefined || storedTimeline.version === version, 'version de frise Atelier incompatible');
    const localTimeline = storedTimeline === undefined ? null
        : normalize({ schema: timelineSchema, version, ...storedTimeline }, byKey, colorAllowed);
    check(!timeline || !localTimeline || same(timeline, localTimeline), 'copies de la frise historique divergentes');
    const legacy = timeline ?? localTimeline;
    let library = wire ?? local;
    if (library && legacy) {
        const projected = library.scenes.find(({ id }) => id === library.defaultId) ??
            (library.scenes.length === 1 ? library.scenes[0] : null);
        check(projected && same(legacy, projected.timeline), 'frise historique différente de la scène exportée');
    }
    if (!library && legacy) {
        const id = 'scene-existante';
        library = { defaultId: legacy.enabled ? id : null, scenes: [{ id, name: 'Scène existante', timeline: legacy }] };
    }
    check(library, 'aucune scène dans le montage');
    for (const { timeline: { tracks } } of library.scenes) for (const track of tracks) {
        const projection = approvedParts.get(track.pieceKey).projection;
        check(!projection || projection.has(track.opticId) || track.clips.every(clip => clip.projection !== true),
            'projection forcée indisponible pour cette optique');
    }
    const installedIds = new Map([...approvedParts].map(([key, part]) => [key, part.id]));
    const scenes = library.scenes.flatMap(({ id, name, timeline }) => {
        const tracks = timeline.tracks.filter(track => !isProjectorOptic(track.opticId));
        return tracks.length || !timeline.tracks.length ? [{ id, name, timeline: { ...timeline, tracks } }] : [];
    });
    const defaultId = scenes.some(scene => scene.id === library.defaultId) ? library.defaultId : null;
    return { defaultId, choices: scenes.map(({ id, name }) => ({ id, name })),
        byId: new Map(scenes.map(({ id, timeline }) => [id, bind({ ...timeline, enabled: true }, installedIds)])) };
}

const triple = ({ x, y, z }) => [x, y, z];

function registerSceneAnchor(part, position, rotation, boneTag) {
    chassisPoses.set(part, { position, rotation, boneTag });
}

function anchorMatches(anchor, { part, boneTag }) {
    const angles = triple(part.rotation);
    return anchor?.bone === part.bone && anchor.boneTag === boneTag &&
        same(anchor.position, triple(part.position)) &&
        Array.isArray(anchor.rotation) && anchor.rotation.length === angles.length &&
        anchor.rotation.every((angle, index) => Number.isFinite(angle) && Math.abs(angle) <= 360 &&
            Math.abs((angle - angles[index] + 900) % 360 - 180) < 1e-7);
}

function catalogVariantMatches(part, attachment, preset) {
    if (part.model === 'ta01_microled') {
        const { r, b } = part.optics[0].color;
        return attachment.feuDiscret?.lentilleModele === (r > b ? 'ta01_microled_red' : 'ta01_microled_blue');
    }
    if (part.emissive && part.emissive.redEnabled !== part.emissive.blueEnabled) {
        return (attachment.pickupColor ?? 'bleu') === (part.emissive.redEnabled ? 'rouge' : 'bleu');
    }
    const colorName = model => ({ red: 'rouge', blue: 'bleu', white: 'blanc' })[model.split('_').at(-1)];
    if (part.model?.startsWith('ta01_minivan_')) {
        return part.zones.every(({ id, model }) => attachment.minivanColors?.[id] === colorName(model));
    }
    if (part.model?.startsWith('ta01_x_')) {
        return attachment.vusXService === preset.service && attachment.vusXColor === colorName(part.zones[0].model);
    }
    return true;
}

function catalogOptics(part) {
    const ids = new Set();
    const addGroup = id => ids.add('group:' + id);
    if (part.zones) part.zones.forEach((_, index) => addGroup(index + 1));
    else if (part.kind === 'lightbar') {
        if (part.emissive) {
            if (part.emissive.redEnabled) addGroup(1);
            if (part.emissive.blueEnabled) addGroup(2);
        } else if (part.pattern) {
            part.pattern.groups.forEach((_, index) => addGroup(index + 1));
            part.pattern.sideWhite.forEach((_, index) => ids.add('side:' + index));
        } else {
            for (const { group } of part.emitters ?? []) addGroup(group);
            if (part.model === 'ta01_roofbar_police') { ids.add('side:0'); ids.add('side:1'); }
        }
    } else if (part.kind === 'strobe' && part.optics) ids.add('discrete');
    else if (part.kind === 'spotlight' && part.beam) ids.add('spotlight');
    for (const id of Object.keys(part.stageLights ?? {})) ids.add('scene:' + id);
    return ids;
}

function catalogProjection(part, optics) {
    return new Set([...optics].filter(id => {
        if (part.model === 'ta01_fantome_lame_270') return false;
        if (part.kind === 'lightbar' && part.emissive && id.startsWith('group:')) return false;
        if (part.zones) return part.model?.startsWith('ta01_fantome_') && Boolean(part.optics?.[id]);
        if (part.pattern && id.startsWith('group:')) return part.pattern.groups[Number(id.slice(6)) - 1]?.power > 0;
        return true;
    }));
}

function approvedCatalogParts(doc, preset, overrides = new Map()) {
    check(Array.isArray(doc?.project?.attachments) && doc.project.attachments.length > 0 &&
        doc.project.attachments.length <= 40, 'pièces du montage invalides');
    const candidates = preset.accessories.map(part => {
        const color = part.model?.startsWith('ta01_fantome_') && part.zones?.length
            ? (part.zones[0].color.r === 255 ? 'rouge' : 'bleu') : undefined;
        const optics = catalogOptics(part);
        const chassis = chassisPoses.get(part);
        return { id: part.id, model: part.model, position: chassis?.position ?? triple(part.position),
            rotation: chassis?.rotation ?? triple(part.rotation), part, boneTag: chassis?.boneTag,
            color, optics, projection: catalogProjection(part, optics), ...overrides.get(part.id) };
    });
    const minivan = preset.model === 'minivan';
    const kit = minivan ? doc.kitMinivan : doc.kitVusXv2;
    const anchors = new Map();
    if (kit !== undefined) {
        check(kit?.schema === (minivan ? 'tryagain.minivan-lighting' : 'tryagain.vus-x-lighting') &&
            kit.version === (minivan ? 1 : 2) && kit.vehicle === preset.model &&
            Array.isArray(kit.pieces) && kit.pieces.length <= 40, 'remise Atelier des ancrages incompatible');
        for (const entry of kit.pieces) {
            if (entry?.anchor === undefined) continue;
            const { pieceKey, anchor } = entry;
            check(validId(pieceKey) && !anchors.has(pieceKey), 'ancrages Atelier en double ou invalides');
            anchors.set(pieceKey, anchor);
        }
    }
    const registered = new Map();
    const used = new Set();
    for (const attachment of doc.project.attachments) {
        const anchor = anchors.get(attachment?.key);
        const matches = candidates.filter(part => part.model && part.model === attachment?.model &&
            part.color === attachment.ghostColor && same(part.position, attachment.position) && same(part.rotation, attachment.rotation) &&
            catalogVariantMatches(part.part, attachment, preset) &&
            (part.part.bone ? anchorMatches(anchor, part) : !anchors.has(attachment.key)));
        check(matches.length === 1 && !used.has(matches[0].id) && !registered.has(attachment?.key),
            'pose, ancrage ou teinte non reconnu dans le catalogue approuvé pour ' + (attachment?.key ?? 'une pièce'));
        const [part] = matches;
        used.add(part.id);
        registered.set(attachment.key, part);
    }
    return registered;
}

function compileCatalogLightScenes(contents, preset, overrides) {
    check(typeof contents === 'string' && Buffer.byteLength(contents) <= limitBytes, 'fichier trop grand ou absent');
    const doc = JSON.parse(contents);
    return compileSceneDocument(doc, preset.model, approvedCatalogParts(doc, preset, overrides));
}

function genericScenePath(preset) {
    check(typeof preset.id === 'string' && /^[a-z0-9-]{1,80}$/.test(preset.id), 'identifiant de profil invalide');
    return 'presets/light-scenes/' + preset.id + '.json';
}

function approvedTenfParts(preset, receipt) {
    const part = preset.accessories.find(({ id }) => id === 'rampe');
    check(preset.model === 'tenf' && preset.service === 'police' && receipt?.status === 'released' &&
        receipt.presetId === preset.id && receipt.model === 'ta01_roofbar_police_scene' &&
        part?.model === receipt.model && validId(receipt.pieceKey), 'rampe Studio 10F incompatible');
    const optics = catalogOptics(part);
    return new Map([[receipt.pieceKey, { id: part.id, model: part.model, position: triple(part.position),
        rotation: triple(part.rotation), optics, projection: catalogProjection(part, optics) }]]);
}

function approvedPhantomParts(preset) {
    return new Map(preset.accessories.map(part => {
        const { id, model, position, rotation, zones } = part;
        const optics = catalogOptics(part);
        return [id, { id, model, position: triple(position), rotation: triple(rotation), color: zones[0].color.r === 255 ? 'rouge' : 'bleu',
            optics, projection: catalogProjection(part, optics) }];
    }));
}

function approvedEmsParts(ems) {
    const { id, model, position, rotation } = ems.part;
    const optics = new Set([...ems.groupOrder.map((_, index) => 'group:' + (index + 1)),
        ...Object.keys(ems.projectorDefinitions).map(id => 'scene:' + id)]);
    return new Map([[ems.pieceKey, { id, model, position: triple(position), rotation: triple(rotation), optics, projection: optics }]]);
}

module.exports = { approvedEmsParts, approvedPhantomParts, approvedTenfParts, compileLightScenes, compileCatalogLightScenes,
    genericScenePath, limitBytes, registerSceneAnchor };
