'use strict';

const { isDeepStrictEqual: same } = require('node:util');
const { compileLightScenes } = require('./light-scenes.js');
const { mountedParts } = require('./installed-mounts.js');

const drawable = /^(?:ta01|celk)_[a-z0-9][a-z0-9_]{0,57}$/;
const piece = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const tintId = /^[a-z][a-z0-9-]{0,31}$/;
const within = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const whole = (n, min, max) => Number.isInteger(n) && within(n, min, max);
const rgb = value => Array.isArray(value) && value.length === 3 && value.every(n => whole(n, 0, 255));
const tuple = (value, limit) => Array.isArray(value) && value.length === 3 && value.every(n => within(n, -limit, limit));
const xyz = ([x, y, z]) => ({ x, y, z });
const object = value => value && Object.getPrototypeOf(value) === Object.prototype;
const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const empty = value => value === undefined || (Array.isArray(value) && !value.length);

function check(condition, reason) {
    if (!condition) throw new Error('Montage châssis : ' + reason);
}

function byPiece(rows) {
    check(Array.isArray(rows) && rows.length > 0 && rows.length <= 20, 'animations invalides');
    const result = new Map();
    for (const row of rows) {
        check(object(row) && typeof row.pieceKey === 'string' && piece.test(row.pieceKey) &&
            !result.has(row.pieceKey), 'animation absente ou répétée');
        result.set(row.pieceKey, row);
    }
    return result;
}

function flash(row, attachment, service, descriptor, tint) {
    const key = attachment.key;
    check(row?.schema === 'tryagain.light-patterns' && row.version === 2 && row.model === attachment.model &&
        (row.service === undefined || row.service === service) &&
        (!descriptor.revision || row.revision === descriptor.revision) &&
        empty(row.sideWhite) && (row.mountPivot === undefined || same(row.mountPivot, [0, 0, 0])) &&
        Array.isArray(row.optics) && row.optics.length >= 1 && row.optics.length <= descriptor.tints.size &&
        Array.isArray(row.patterns) && row.patterns.length >= 1 && row.patterns.length <= 64, 'animation incompatible pour ' + key);
    if (attachment.lightLab !== undefined) {
        check(only(attachment.lightLab, ['activeId', 'patterns']) && same(attachment.lightLab.patterns, row.patterns) &&
            attachment.lightLab.activeId === row.activeId, 'motifs Atelier et exportés divergents pour ' + key);
    }
    const overlays = new Set();
    for (const [index, optic] of row.optics.entries()) {
        const approved = [...descriptor.tints.values()].find(entry => entry.model === optic?.overlay);
        check(approved && !overlays.has(optic.overlay) && optic.id === index + 1 &&
            same(optic.color, approved.color) && (optic.teinte === undefined || optic.teinte === approved.id) &&
            optic.enabled === (approved === tint) && (optic.zone === undefined || optic.zone === 'centre') &&
            (optic.projection === undefined || optic.projection === false),
        'lentille ou teinte incompatible pour ' + key);
        overlays.add(optic.overlay);
    }
    const selectedIndex = row.optics.findIndex(optic => optic.overlay === tint.model);
    const selected = row.patterns.filter(entry => entry?.id === row.activeId);
    check(selectedIndex >= 0 && selected.length === 1 && Array.isArray(selected[0].steps) &&
        selected[0].steps.length >= 1 && selected[0].steps.length <= 32, 'motif actif absent pour ' + key);
    check(empty(selected[0].groups) || (Array.isArray(selected[0].groups) &&
        selected[0].groups.every(group => object(group) && group.power === 0)),
    'projection du motif hors du contrat pour ' + key);
    let total = 0;
    const steps = selected[0].steps.map(step => {
        check(whole(step?.duration, 40, 5000) && Array.isArray(step.levels) && step.levels.length === row.optics.length &&
            step.levels.every(level => within(level, 0, 100)), 'phase invalide pour ' + key);
        total += step.duration;
        return { duration: step.duration, levels: [step.levels[selectedIndex]] };
    });
    check(total <= 30000, 'motif trop long pour ' + key);
    return steps;
}

function compileChassisMount({ bytes, doc, model, service, packs }) {
    check(only(doc, ['schema', 'version', 'project', 'axes', 'animationsLumieres', 'scenesLumieres',
        'timelineLumiere', 'projecteurs', 'diffusionsLentilles']) &&
        only(doc.project, ['vehicle', 'name', 'attachments', 'lightScenes', 'lightTimeline']) &&
        doc.project.vehicle === model && empty(doc.projecteurs) && empty(doc.diffusionsLentilles),
    'montage hors contrat portable : ancrages de kit, projecteurs, diffusion et options GTA demandent une remise compatible');
    check(same(doc.axes, { space: 'vehicle', position: 'metres', rotation: 'degrees', eulerOrder: 'ZXY', up: '+Z', forward: '+Y' }),
        'repère véhicule mètres/degrés ZXY requis');
    const animations = byPiece(doc.animationsLumieres);
    const ownership = new Map();
    for (const pack of packs) for (const [name, descriptor] of pack.parts) {
        check(!ownership.has(name), 'modèle d’accessoire fourni par deux packs : ' + name);
        ownership.set(name, { pack, descriptor });
    }
    const approved = new Map(), usedPacks = new Set();
    const parts = doc.project.attachments.map(attachment => {
        check(only(attachment, ['key', 'position', 'rotation', 'model', 'ghostColor', 'vusXColor', 'vusXService', 'lightLab']),
            'champs de pièce non pris en charge');
        const { key, position, rotation, model: name, ghostColor, vusXColor, vusXService } = attachment;
        const found = ownership.get(name);
        const tint = found?.descriptor.tints.get(ghostColor ?? vusXColor);
        check(typeof key === 'string' && piece.test(key) && !approved.has(key) && found && tint &&
            (ghostColor === undefined || vusXColor === undefined || ghostColor === vusXColor) &&
            (vusXService === undefined || vusXService === service) &&
            tuple(position, 6) && tuple(rotation, 180),
        'pièce, pose, teinte ou ancrage invalide : ' + key);
        usedPacks.add(found.pack.id);
        const ghostSteps = flash(animations.get(key), attachment, service, found.descriptor, tint);
        const [r, g, b] = tint.color;
        const group = 'group:1';
        approved.set(key, { id: key, model: name, position, rotation, color: ghostColor,
            optics: new Set([group]), projection: new Set(),
            colors: new Map([[group, new Set([tint.id])]]), unlitLens: new Map([[group, tint.id]]) });
        return { id: key, slot: key, name, kind: 'prop', model: name, position: xyz(position), rotation: xyz(rotation),
            ghostSteps, zones: [{ id: 'centre', model: tint.model, color: { r, g, b, id: tint.id } }] };
    });
    check(animations.size === parts.length && usedPacks.size === packs.length, 'animations ou dépendances superflues');
    mountedParts({ renderedParts: parts }, parts.map(part => part.id));
    const scenes = doc.scenesLumieres !== undefined || doc.project.lightScenes !== undefined ||
        doc.timelineLumiere !== undefined || doc.project.lightTimeline !== undefined;
    const library = scenes ? compileLightScenes(bytes.toString('utf8'), model, approved)
        : { defaultId: null, choices: [], byId: new Map() };
    return { parts, renderedParts: parts, library };
}

module.exports = { compileChassisMount, drawable, tintId, rgb };
