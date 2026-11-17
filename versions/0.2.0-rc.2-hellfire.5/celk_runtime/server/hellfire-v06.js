'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual: same } = require('node:util');
const { compileLightScenes, approvedPhantomParts } = require('./light-scenes.js');
const { normalize } = require('./light-timeline.js');
const { compileChassisParts } = require('./chassis-optics.js');
const { compilePhantomAtelierParts } = require('./phantom-atelier-4.js');
const { createProjectionView } = require('./projection-view.js');
const { mountedParts } = require('./installed-mounts.js');
const { maxAccessoriesPerVehicle } = require('../installation-limits.json');
const studioQ = require('./hellfire-studio-q.js');
const { createCentreAdapter } = require('./projection-adaptation.cjs');
const centreProjection = createCentreAdapter(require('./profil-moteur-centre-v2.json'));

const identity = { id: 'hellfire-police-v06-lab', version: '0.6.0', renderer: 'hellfire-optics-v06' };
const tableSha = '1a501c19e3c2c7983d90ee060cdb13ae46d2ad4bbeac20341a097cb89d308614';
const axes = { space: 'vehicle', position: 'metres', rotation: 'degrees', eulerOrder: 'ZXY', up: '+Z', forward: '+Y' };
const diffusionUnits = { space: 'part-mount-pivot', position: 'm', range: 'm', opening: 'deg', intensity: 'relative', falloff: 'relative' };
const diffusionFields = ['enabled', 'rangeM', 'openingDeg', 'intensity', 'falloff', 'yawDeg', 'pitchDeg'];
const sourceId = /^[a-zA-Z0-9_.:-]{1,96}$/;
const key = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const plain = value => value && Object.getPrototypeOf(value) === Object.prototype;
const only = (value, names) => plain(value) && Object.keys(value).every(name => names.includes(name));
const within = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const tuple = (value, limit) => Array.isArray(value) && value.length === 3 && value.every(n => within(n, -limit, limit));
const xyz = ([x, y, z]) => ({ x, y, z });
const rgb = ([r, g, b]) => ({ r, g, b });
const rotationWire = angles => xyz(angles.map(n => n > 180 ? n - 360 : n < -180 ? n + 360 : n));

function need(ok, error) {
    if (!ok) throw new Error('Hellfire V06 · ' + error);
}

function studioTable() {
    const bytes = readFileSync(join(__dirname, 'hellfire-v06-studio.json'));
    need(createHash('sha256').update(bytes).digest('hex') === tableSha, 'table Studio différente de la révision approuvée');
    return JSON.parse(bytes);
}

function byKey(rows, label, maximum) {
    need(Array.isArray(rows) && rows.length <= maximum, `${label} : liste invalide`);
    const indexed = new Map();
    for (const row of rows) {
        need(typeof row?.pieceKey === 'string' && key.test(row.pieceKey) && !indexed.has(row.pieceKey),
            `${label} : clé de pièce invalide ou répétée`);
        indexed.set(row.pieceKey, row);
    }
    return indexed;
}

function sourcesByPiece(rows) {
    need(Array.isArray(rows) && rows.length <= 160, 'sources de projection : liste invalide');
    const parts = new Map();
    for (const row of rows) {
        need(typeof row?.pieceKey === 'string' && key.test(row.pieceKey), 'source de projection : clé de pièce invalide');
        if (!parts.has(row.pieceKey)) parts.set(row.pieceKey, []);
        parts.get(row.pieceKey).push(row);
    }
    return parts;
}

function readOptions(doc) {
    const { optionsGta, catalogueMecano } = doc;
    need(optionsGta === undefined || (only(optionsGta, ['vehicule', 'livree', 'livreeGta', 'pieces']) &&
        optionsGta.vehicule === 'gauntlet4' && optionsGta.livree == null && optionsGta.livreeGta == null &&
        Array.isArray(optionsGta.pieces) && optionsGta.pieces.length <= 512 && optionsGta.pieces.every(row =>
            row?.type === 'stock' && row.extra == null && row.kit == null && row.index == null && row.visible === true &&
            same(row.origine, row.position) && same(row.rotation, [0, 0, 0]))),
    'seules les options natives d’origine sont prises en charge');
    need(catalogueMecano === undefined || (catalogueMecano?.vehicule === 'gauntlet4' &&
        Array.isArray(catalogueMecano.pieces) && catalogueMecano.pieces.length <= 512), 'catalogue mécano incompatible');
}

function otherAtelierDrafts(mounts, model) {
    if (mounts === undefined) return true;
    if (!plain(mounts) || Object.hasOwn(mounts, model)) return false;
    const drafts = Object.entries(mounts);
    return drafts.length <= 512 && drafts.every(([name, draft]) => key.test(name) && plain(draft));
}

function readPattern(item, spec, row, revision) {
    if (!row) {
        need(item.lightLab === undefined, 'motif Atelier présent sans animation exportée pour ' + item.key);
        return null;
    }
    need(row.schema === 'tryagain.light-patterns' && row.version === 1 && row.model === item.model &&
        row.service === 'police' && row.revision === revision && same(row.mountPivot, spec.pivotM) &&
        Array.isArray(row.sideWhite) && row.sideWhite.length === 0,
    'animation ou révision incompatible pour ' + item.key);
    if (item.lightLab !== undefined) {
        need(same(item.lightLab, { activeId: row.activeId, patterns: row.patterns }), 'motifs Atelier et export différents pour ' + item.key);
    }
    const eyes = new Map(spec.optics.map(eye => [Number(eye.opticIdAtelier.slice(6)), eye]));
    need(Array.isArray(row.optics) && row.optics.length === eyes.size && new Set(row.optics.map(eye => eye?.id)).size === eyes.size,
        'inventaire optique incompatible pour ' + item.key);
    for (const optic of row.optics) {
        const eye = eyes.get(optic?.id);
        const emitter = eye?.control === 'J' ?
            add(add(spec.fits.yawPivotM, spec.fits.pitchPivotFromYawM), eye.emissionM) : eye?.emissionM;
        need(eye && same(optic.color, eye.rgb) && Array.isArray(optic.emitters) && optic.emitters.length === 1 &&
            tuple(optic.emitters[0], 6) && near(optic.emitters[0], emitter) &&
            Array.isArray(optic.faces) && optic.faces.length === 1 && only(optic.faces[0], ['position', 'direction']) &&
            same(optic.faces[0].position, optic.emitters[0]) && same(optic.faces[0].direction, eye.axis),
        `repère ou teinte différent pour ${item.key}/group:${optic?.id}`);
    }
    need(Array.isArray(row.patterns) && row.patterns.length >= 1 && row.patterns.length <= 64 &&
        new Set(row.patterns.map(pattern => pattern?.id)).size === row.patterns.length, 'liste de motifs invalide pour ' + item.key);
    for (const pattern of row.patterns) {
        need(typeof pattern?.id === 'string' && key.test(pattern.id) && typeof pattern.name === 'string' && pattern.name.length <= 120 &&
            Array.isArray(pattern.groups) && pattern.groups.length === eyes.size &&
            Array.isArray(pattern.steps) && pattern.steps.length >= 1 && pattern.steps.length <= 512,
        'motif hors contrat pour ' + item.key);
        for (const [index, group] of pattern.groups.entries()) {
            need(group?.id === index + 1 && tuple(group.direction, 1) && Math.abs(Math.hypot(...group.direction) - 1) < 1e-5 &&
                within(group.range, 0, 100) && within(group.angle, 0, 89.9) && within(group.power, 0, 20),
            `projection invalide pour ${item.key}/group:${index + 1}`);
        }
        need(pattern.steps.every(step => Number.isInteger(step?.duration) && within(step.duration, 1, 300000) &&
            Array.isArray(step.levels) && step.levels.length === eyes.size &&
            step.levels.every(level => within(level, 0, 100))) &&
            pattern.steps.reduce((sum, step) => sum + step.duration, 0) <= 300000, 'phases invalides pour ' + item.key);
    }
    const selected = row.patterns.find(pattern => pattern.id === row.activeId);
    need(selected, 'motif actif absent pour ' + item.key);
    return selected;
}

function readProjector(row, eye, local) {
    if (local !== undefined) {
        need(row && same(local, { [eye.opticId]: { on: false, color: 'blanc', yaw: row.yawDeg, pitch: row.pitchDeg,
            baseYaw: row.yawDeg, basePitch: row.pitchDeg, minYaw: row.yawMinDeg, maxYaw: row.yawMaxDeg,
            minPitch: row.pitchMinDeg, maxPitch: row.pitchMaxDeg } }), 'réglages J du projet et de l’export divergents pour ' + row?.pieceKey);
    }
    if (!row) return { yaw: 0, pitch: 0, yawMin: 0, yawMax: 0, pitchMin: 0, pitchMax: 0 };
    need(only(row, ['pieceKey', 'opticId', 'yawDeg', 'pitchDeg', 'yawMinDeg', 'yawMaxDeg', 'pitchMinDeg', 'pitchMaxDeg']) &&
        row.opticId === eye.opticIdAtelier && within(row.yawMinDeg, -180, 180) && within(row.yawMaxDeg, row.yawMinDeg, 180) &&
        within(row.pitchMinDeg, -90, 90) && within(row.pitchMaxDeg, row.pitchMinDeg, 90) &&
        within(row.yawDeg, row.yawMinDeg, row.yawMaxDeg) && within(row.pitchDeg, row.pitchMinDeg, row.pitchMaxDeg),
    'visée ou butées incompatibles pour ' + row.pieceKey);
    return { yaw: row.yawDeg, pitch: row.pitchDeg, yawMin: row.yawMinDeg, yawMax: row.yawMaxDeg,
        pitchMin: row.pitchMinDeg, pitchMax: row.pitchMaxDeg };
}

function nativeEye(eye, group, diffusion) {
    return { group: eye.opticIdAtelier, model: eye.modelEmissif, color: rgb(eye.rgb),
        origin: eye.emissionM, axis: group?.direction ?? eye.axis, range: group?.range ?? eye.rangeM,
        angle: group === undefined ? eye.totalAngleDeg : 2 * group.angle, power: group?.power ?? eye.intensity,
        falloff: eye.falloff, ...(diffusion && { enabled: diffusion.enabled, origin: diffusion.emitters[0].origin,
            axis: diffusion.emitters[0].axis, range: diffusion.rangeM, angle: diffusion.openingDeg,
            power: diffusion.intensity, falloff: diffusion.falloff,
            ...(diffusion.sourceEnabled !== undefined && { sourceEnabled: diffusion.sourceEnabled }) }) };
}

function centreEye(eye, pieceKey, whenInherited) {
    if (eye.range <= 0 || eye.power <= 0 || eye.angle <= 0) return eye;
    // R02 exports author values. Convert once, without Phantom presets or its exposed-face clamp.
    // Phase level and enabled/source flags remain live controls in the renderer.
    const native = centreProjection({ pieceKey, opticId: eye.group, enabled: true,
        originLocalM: eye.origin, axisLocal: eye.axis, color: [eye.color.r, eye.color.g, eye.color.b],
        author: { rangeM: eye.range, openingDeg: eye.angle, intensity: eye.power, falloff: eye.falloff } },
    { level: 100, projectionEnabled: true });
    return { ...eye, nativeProjection: {
        engineProfile: native.engineProfile, range: native.rangeM, power: native.brightness,
        hardness: native.hardness, size: native.nativeSizeArgument, falloff: native.falloff, whenInherited,
    } };
}

function offsetAxis(source, yaw, pitch) {
    if (yaw === 0 && pitch === 0) return source;
    const [x, y, z] = source;
    const horizontal = Math.hypot(x, y);
    const radians = Math.PI / 180;
    const heading = (horizontal > 1e-9 ? Math.atan2(-x, y) : 0) + yaw * radians;
    const elevation = Math.atan2(z, horizontal) + pitch * radians;
    return [-Math.sin(heading) * Math.cos(elevation), Math.cos(heading) * Math.cos(elevation), Math.sin(elevation)];
}

const near = (actual, expected) => actual.every((n, i) => Math.abs(n - expected[i]) <= 1e-6);
const settingsOf = optic => Object.fromEntries(diffusionFields.map(name => [name, optic[name]]));
const validSettings = optic => typeof optic.enabled === 'boolean' && within(optic.rangeM, 0, 100) &&
    within(optic.openingDeg, 1, 179.8) && within(optic.intensity, 0, 20) && within(optic.falloff, 0, 100) &&
    within(optic.yawDeg, -180, 180) && within(optic.pitchDeg, -90, 90);

function turnX([x, y, z], degrees) {
    const angle = degrees * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return [x, y * cos - z * sin, y * sin + z * cos];
}

function turnZ([x, y, z], degrees) {
    const angle = degrees * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return [x * cos - y * sin, x * sin + y * cos, z];
}

const add = (a, b) => a.map((n, i) => n + b[i]);

function stageSource({ eye, aim, fits }, optic) {
    // Atelier writes the beam in the body's frame at the initial aim. CELK renders in the moving head's frame.
    const origin = add(fits.yawPivotM, turnZ(add(fits.pitchPivotFromYawM, turnX(eye.emissionM, aim.pitch)), aim.yaw));
    const axis = offsetAxis(turnZ(turnX(eye.axis, aim.pitch), aim.yaw), optic.yawDeg, optic.pitchDeg);
    return { origin, axis, head: { origin: eye.emissionM, axis: turnX(turnZ(axis, -aim.yaw), -aim.pitch) } };
}

function readDiffusions(item, q, raw, revision, j) {
    const local = item.lensDiffusion === undefined ? {} : item.lensDiffusion;
    const prefix = `diffusion ${item.key}`;
    need(plain(local), `${prefix} : réglages locaux illisibles`);
    if (!raw) {
        need(Object.keys(local).length === 0, `${prefix} : réglage local absent du bloc exporté`);
        return new Map();
    }
    need(only(raw, ['schema', 'version', 'pieceKey', 'model', 'revision', 'units', 'optics']) &&
        raw.schema === 'tryagain.lens-diffusion' && raw.version === 1 && raw.model === item.model &&
        raw.revision === revision && same(raw.units, diffusionUnits) && Array.isArray(raw.optics) &&
        raw.optics.length > 0 && raw.optics.length <= q.size + Number(Boolean(j)) && raw.optics.length === Object.keys(local).length,
    `${prefix} : version, repère ou inventaire optique incompatible`);
    const result = new Map();
    for (const optic of raw.optics) {
        const eye = q.get(optic?.id);
        const stage = optic?.id === 'scene:scene' && j;
        const label = `${prefix}/${optic?.id}`;
        need((eye || stage) && !result.has(optic.id) && only(optic, ['id', ...diffusionFields, 'emitters']) && validSettings(optic),
            `${label} : valeurs ou identité incompatibles`);
        const authored = local[optic.id];
        need(only(authored, diffusionFields) && Object.keys(authored).length > 0 &&
            Object.entries(authored).every(([name, value]) => optic[name] === value), `${label} : copies Atelier divergentes`);
        const source = Array.isArray(optic.emitters) && optic.emitters[0];
        const expected = stage ? stageSource(stage, optic) :
            { origin: eye.emissionM, axis: offsetAxis(eye.axis, optic.yawDeg, optic.pitchDeg) };
        need(source && optic.emitters.length === 1 && only(source, ['origin', 'axis']) &&
            tuple(source.origin, 6) && near(source.origin, expected.origin) && tuple(source.axis, 1.00001) &&
            near(source.axis, expected.axis), `${label} : repère ou source différente de Studio`);
        result.set(optic.id, stage ? { ...optic, emitters: [expected.head] } : optic);
    }
    return result;
}

function resolveSources(item, rows, q, pattern, diffusions) {
    const local = item.projectionSources === undefined ? {} : item.projectionSources;
    need(plain(local) && rows.length === Object.keys(local).length && rows.length <= q.size,
        'sources de projection et copie Atelier divergentes pour ' + item.key);
    const seen = new Set();
    for (const row of rows) {
        const eye = q.get(row.opticId);
        const label = `source ${item.key}/${row.opticId}`;
        need(eye && !seen.has(row.opticId) && only(row, ['pieceKey', 'model', 'opticId', 'color', 'space', 'settings', 'sources']) &&
            row.model === item.model && row.space === diffusionUnits.space && same(row.color, eye.rgb) &&
            only(row.settings, diffusionFields) && validSettings(row.settings) && Array.isArray(row.sources) && row.sources.length <= 1,
        `${label} : identité, paramètres ou sources non pris en charge`);
        seen.add(row.opticId);
        const authored = diffusions.get(row.opticId);
        const { settings } = row;
        if (authored) need(same(settingsOf(authored), settings), `${label} : paramètres de diffusion divergents`);
        else {
            const inherited = nativeEye(eye, pattern?.groups[Number(row.opticId.slice(6)) - 1]);
            need(settings.enabled === true && settings.yawDeg === 0 && settings.pitchDeg === 0 &&
                settings.rangeM === inherited.range && settings.openingDeg === inherited.angle && settings.intensity === inherited.power &&
                settings.falloff === 2,
            `${label} : source héritée et réglages d’origine divergents`);
        }
        const source = row.sources[0];
        const original = authored?.emitters[0] ?? { origin: eye.emissionM, axis: eye.axis };
        if (row.sources.length === 0) {
            need(same(local[row.opticId], []), `${label} : liste locale et exportée différentes`);
            diffusions.set(row.opticId, { ...settings, emitters: [original], sourceEnabled: false });
            continue;
        }
        need(only(source, ['id', 'emitterIndex', 'enabled', 'originM', 'axis']) && typeof source.id === 'string' && sourceId.test(source.id) &&
            source.emitterIndex === 0 && (source.enabled === undefined || typeof source.enabled === 'boolean') &&
            same(local[row.opticId], [{ id: source.id, emitterIndex: 0, ...(source.enabled !== undefined && { enabled: source.enabled }) }]),
        `${label} : une seule source Studio, sans déplacement, est prise en charge`);
        need(tuple(source.originM, 6) && tuple(source.axis, 1.00001) && near(source.originM, original.origin) &&
            near(source.axis, original.axis), `${label} : origine ou axe différent de l’émetteur Studio`);
        diffusions.set(row.opticId, { ...settings, emitters: [{ origin: source.originM, axis: source.axis }],
            sourceEnabled: source.enabled !== false });
    }
    return diffusions;
}

function compileHellfirePart(item, spec, animation, request, diffusion, sources, revision) {
    need(only(item, ['key', 'model', 'position', 'rotation', 'lightLab', 'sceneProjectors', 'lensDiffusion', 'projectionSources']),
        'champs optiques inconnus pour ' + item.key);
    need(!spec.fits.boneCandidate || (same(item.position, spec.poseChassisM) && same(item.rotation, spec.rotationZXYDeg)),
        'pose de porte à recalibrer pour ' + item.key);
    const stageEye = spec.optics.find(eye => eye.control === 'J');
    const pattern = readPattern(item, spec, animation, revision);
    const q = new Map(spec.optics.filter(eye => eye.control === 'Q').map(eye => [eye.opticIdAtelier, eye]));
    need((!request && item.sceneProjectors === undefined) || stageEye, 'réglage J pour une pièce Q : ' + item.key);
    const aim = stageEye && readProjector(request, stageEye, item.sceneProjectors);
    const authored = resolveSources(item, sources, q, pattern, readDiffusions(item, q, diffusion, revision,
        stageEye && { eye: stageEye, aim, fits: spec.fits }));
    const eyes = [...q.values()].map((eye, i) => {
        const rendered = nativeEye(eye, pattern?.groups[i], authored.get(eye.opticIdAtelier));
        return centreEye(rendered, item.key, authored.has(eye.opticIdAtelier));
    });
    const stage = stageEye && { ...aim, eye: nativeEye(stageEye, undefined, authored.get('scene:scene')),
        fork: spec.articulationModels.lacet, head: spec.articulationModels.tete,
        yawPivot: xyz(spec.fits.yawPivotM), pitchPivot: xyz(spec.fits.pitchPivotFromYawM) };
    const name = stage ? (spec.ref === '12' ? 'Projecteur gauche' : 'Projecteur droit') : item.model;
    return { id: item.key, slot: item.key, name, kind: identity.renderer, model: item.model,
        position: xyz(item.position), rotation: rotationWire(item.rotation), eyes,
        ...(spec.fits.boneCandidate ? { door: spec.fits.boneCandidate } : {}),
        ...(stage ? { projector: stage } : {}),
        ...(q.size && pattern ? { steps: pattern.steps.map(({ duration, levels }) => ({ duration, levels })) } : {}) };
}

function checkParent(item, spec, studio, byModel, registered) {
    if (!spec.fits.parentPieceKey) return;
    const modernRamp = byModel.get(studioQ.ramp08);
    if (modernRamp) {
        const base = registered.get(studioQ.ramp08).part;
        const measured = studioQ.projectorPoses.get(item.model);
        need(measured && same(modernRamp.position, base.poseChassisM) && same(modernRamp.rotation, base.rotationZXYDeg) &&
            same(item.position, measured.position) && same(item.rotation, measured.rotation),
        'repères V08 de la platine et du projecteur à recalibrer pour ' + item.key);
        return;
    }
    const ref = studio.parts.find(row => row.pieceKeyTemoin === spec.fits.parentPieceKey);
    const parent = byModel.get(ref.model);
    need(parent && same(parent.position, ref.poseChassisM) && same(parent.rotation, ref.rotationZXYDeg) &&
        same(item.position, spec.poseChassisM) && same(item.rotation, spec.rotationZXYDeg),
    'repères de la platine et du projecteur à recalibrer pour ' + item.key);
}

function registryFor(packs, studio) {
    const registry = new Map();
    const native = packs.filter(pack => [identity.renderer, studioQ.renderer].includes(pack.renderer));
    for (const pack of native) for (const [model, part] of pack.parts) {
        need(!registry.has(model), 'modèle Hellfire dupliqué dans les packs : ' + model);
        registry.set(model, { part, pack, revision: part.revision ?? studio.revisionStudio });
    }
    return { registry, native, mixed: packs.filter(pack => !native.includes(pack)) };
}

function compileAdditions(doc, additions, animations, service, mixed, approved, diffusions, sourcesProjection) {
    const phantom = mixed.find(pack => pack.legacy);
    const phantomPieces = additions.filter(item => phantom?.parts.has(item.model));
    need(Boolean(phantomPieces.length) === Boolean(phantom) &&
        Boolean(phantom) === (doc.kitFantomeGrandFormat !== undefined), 'pack et kit Phantom mélangés incohérents');
    const others = additions.filter(item => !phantom?.parts.has(item.model));
    need(Array.isArray(sourcesProjection) &&
        (phantom || (!diffusions.length && !sourcesProjection.length)), 'diffusion sans pack Phantom associé');
    const parts = [], rendered = [];
    if (phantom) {
        const sourceAnimations = phantomPieces.map(({ key: id }) => {
            const row = animations.get(id);
            need(row?.schema === 'tryagain.light-patterns' && row.version === 2 && row.service === service,
                'motif Phantom v2 invalide pour ' + id);
            animations.delete(id);
            return row;
        });
        const { accessories } = compilePhantomAtelierParts(phantom.base, doc, { attachments: phantomPieces,
            vehicle: doc.project.vehicle, animations: sourceAnimations, diffusions, sourcesProjection });
        parts.push(...accessories);
        rendered.push(...createProjectionView({ profile: phantom.profile }).parts(accessories));
        for (const [id, part] of approvedPhantomParts({ accessories })) {
            approved.set(id, { ...part, colors: new Map([['group:1', new Set([part.color])]]),
                unlitLens: new Map([['group:1', part.color]]) });
        }
    }
    const extra = compileChassisParts({ attachments: others, animations, service, packs: mixed.filter(pack => pack !== phantom) });
    parts.push(...extra.parts);
    rendered.push(...extra.parts);
    for (const [id, part] of extra.approved) approved.set(id, part);
    return { parts, rendered };
}

function orderedParts(parts, attachments) {
    const byId = new Map(parts.map(part => [part.id, part]));
    return attachments.map(({ key: id }) => byId.get(id));
}

function compileHellfireMount({ bytes, doc, model, service, packs }) {
    need(model === 'gauntlet4' && service === 'police' && doc?.schema === 'tryagain.vehicle-mount' && doc.version === 1 &&
        only(doc, ['schema', 'version', 'project', 'axes', 'projecteurs', 'animationsLumieres', 'optionsGta', 'catalogueMecano',
            'scenesLumieres', 'timelineLumiere', 'diffusionsLentilles', 'kitFantomeGrandFormat', 'sourcesProjection', 'preview']) &&
        only(doc.project, ['name', 'vehicle', 'attachments', 'layers', 'mounts', 'vehicleSettings', 'lightScenes', 'lightTimeline']) &&
        doc.project.vehicle === model && same(doc.axes, axes) && (doc.project.layers === undefined || same(doc.project.layers, [])) &&
        otherAtelierDrafts(doc.project.mounts, model) &&
        (doc.project.vehicleSettings === undefined || same(doc.project.vehicleSettings, {})), 'montage, service ou repère hors contrat');
    readOptions(doc);
    const studio = studioTable();
    const { registry, native, mixed } = registryFor(packs, studio);
    const { attachments } = doc.project;
    need(Array.isArray(attachments) && attachments.length > 0 && attachments.length <= maxAccessoriesPerVehicle, 'nombre de pièces invalide');
    const animations = byKey(doc.animationsLumieres ?? [], 'Animations', attachments.length);
    const projectors = byKey(doc.projecteurs ?? [], 'Projecteurs', 2);
    const diffusions = byKey(doc.diffusionsLentilles ?? [], 'Diffusions', attachments.length);
    const sources = sourcesByPiece(doc.sourcesProjection ?? []);
    const seen = new Set();
    const parts = [], additions = [], approved = new Map(), nativeByModel = new Map();
    for (const item of attachments) {
        need(typeof item?.key === 'string' && key.test(item.key) && !seen.has(item.key) &&
            tuple(item.position, 6) && tuple(item.rotation, 360), 'clé ou pose incompatible pour ' + item?.key);
        seen.add(item.key);
        if (registry.has(item.model)) {
            need(!nativeByModel.has(item.model), 'modèle Hellfire répété : ' + item.model);
            nativeByModel.set(item.model, item);
        } else additions.push(item);
    }
    const used = new Set();
    let original;
    for (const [name, item] of nativeByModel) {
        const { part: spec, pack, revision } = registry.get(name);
        used.add(pack.id);
        const hasV08 = nativeByModel.has(studioQ.ramp08);
        need(!(hasV08 && pack.renderer === identity.renderer && !spec.articulationModels),
            'La composition V08 ne comprend que les deux projecteurs du pack V06');
        need(pack.id !== 'hellfire-feux-v07-lab' || hasV08, 'La composition qualifiée des feux V07 utilise la rampe V08');
        checkParent(item, spec, studio, nativeByModel, registry);
        const animation = animations.get(item.key);
        const part = compileHellfirePart(item, spec, animation, projectors.get(item.key),
            diffusions.get(item.key), sources.get(item.key) ?? [], revision);
        animations.delete(item.key);
        projectors.delete(item.key);
        diffusions.delete(item.key);
        sources.delete(item.key);
        const optics = new Set(part.eyes.map(eye => eye.group));
        approved.set(item.key, { id: item.key, model: name, position: item.position, rotation: item.rotation, optics, projection: optics });
        if (spec.defaultAnimation && !animation) {
            const { durationMs, tracks } = spec.defaultAnimation;
            original = normalize({ schema: 'tryagain.light-timeline', version: 1, durationMs, enabled: true, loop: true,
                tracks: tracks.map(track => ({ ...track, pieceKey: item.key })) }, new Map([[item.key, optics]]));
        }
        parts.push(part);
    }
    need(parts.length > 0 && used.size === native.length && projectors.size === 0, 'pack Hellfire inutilisé ou réglage J inconnu');
    const extra = compileAdditions(doc, additions, animations, service, mixed, approved, [...diffusions.values()], [...sources.values()].flat());
    const library = compileLightScenes(bytes.toString('utf8'), model, approved);
    if (original) library.original = original;
    const renderedParts = orderedParts([...parts, ...extra.rendered], attachments);
    mountedParts({ renderedParts }, attachments.map(row => row.key));
    return { parts: orderedParts([...parts, ...extra.parts], attachments), renderedParts, library };
}

module.exports = { identity, studioTable, compileHellfireMount };
