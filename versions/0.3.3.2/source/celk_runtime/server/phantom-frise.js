'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isDeepStrictEqual: same } = require('node:util');
const { fromExport, bind } = require('./light-timeline.js');
const revision = 'DEV-01-TA01-FANTOME-OPTIQUES-v01';
const studioSha = 'a582d59c04256d1e3058022541710eebc7688d609f95e5fedc4f07f92a37250d';
const hash = value => createHash('sha256').update(value).digest('hex');
const index = value => new Map(value.map(entry => [entry.pieceKey, entry]));
const approx = (value, expected) => typeof value === 'number' && Math.abs(value - expected) <= 1e-6;
const source = 'presets/phantom-frise/';
const rgb = { rouge: [255, 12, 9], bleu: [24, 72, 255] };
const models = new Map([
    ['ta01_fantome_rond', 'rond'], ['ta01_fantome_rect', 'rectangle'], ['ta01_fantome_lame', 'lame'],
]);
const registry = new Map([...models.keys()].map(name => [name, new Set(['group:1'])]));
const ytyp = 'ta01_fantome_optics.ytyp';
const streamSha = Object.freeze({
    'ta01_fantome_lame_blue.ydr': 'e156709596617792ca2f9c7d125f388c734deb064d116a12313390157fd64522',
    'ta01_fantome_lame_red.ydr': 'df65b11433733bc89c5ae17e41937354915c8b9e8286cb8bbb92285205e8e78f',
    'ta01_fantome_lame.ydr': 'a7bbba7cda2baff265c237bb1b134549ef54c248f619206899f2cabdf8920381',
    'ta01_fantome_optics.ytyp': '4023653cf8a7735bad53ca7ebf2d641fb93fee1d7b598239820358d7b5dc30da',
    'ta01_fantome_rect_blue.ydr': '6602c645fc0d4488c5fbf3fb537d48e2e529c3265f10241f1cbebd61bc7cc036',
    'ta01_fantome_rect_red.ydr': '68b736aad0c8042425b43091de3c6788d9f141f6a03f0d51abb8f03d3a5ef513',
    'ta01_fantome_rect.ydr': 'fcc0f92692e1ca007067f197cc6724d4374a34975a11579ed9b88612ace0c643',
    'ta01_fantome_rond_blue.ydr': '95fff1b7ee28400b8aad0d464e4d06bcbd9da56c09b8a4a1b8c0aef353a2beb8',
    'ta01_fantome_rond_red.ydr': 'a1c9a83bfe9db2c27d1150e2e439b3a676de7c04a8bb44cc70b2e503efa82fc5',
    'ta01_fantome_rond.ydr': '6ac55d1fe31de0171fb86cb01c4d6231181395a946602177117a79439f76d1ba',
});
const noOverride = { enabled: false, rangeM: 3, openingDeg: 120, intensity: 0.35, falloff: 2 };
const vector = (list, limit) => Array.isArray(list) && list.length === 3 &&
    list.every(n => Number.isFinite(n) && Math.abs(n) <= limit);
const xyz = ([x, y, z]) => ({ x, y, z });
const tint = ([r, g, b]) => ({ r, g, b });
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;

function check(pass, message) {
    if (!pass) throw new Error('Phantom Atelier : ' + message);
}

function verifyAsset(base, asset, name) {
    const expected = streamSha[name];
    check(expected && asset?.source === 'stream/' + name && asset.sha256 === expected, 'preuve différente : ' + name);
    const bytes = readFileSync(join(base, 'stream', name));
    check(bytes.toString('ascii', 0, 4) === 'RSC7' && hash(bytes) === expected, 'actif différent : ' + name);
}

function profile(raw, model, metadata, assetRevision = revision) {
    const base = { ...noOverride, emitters: [{ origin: metadata.emissionPoint, axis: metadata.axis }] };
    if (!raw) return base;
    const list = raw.optics;
    const units = { space: 'part-mount-pivot', position: 'm', range: 'm', opening: 'deg',
        intensity: 'relative', falloff: 'relative' };
    check(raw.schema === 'tryagain.lens-diffusion' && raw.version === 1 && raw.model === model &&
        raw.revision === assetRevision && same(raw.units, units) && Array.isArray(list) && list.length === 1 &&
        list[0].id === 'group:1', 'diffusion ou optique incompatible');
    const { enabled, rangeM, openingDeg, intensity, falloff, yawDeg, pitchDeg, emitters } = list[0];
    check(typeof enabled === 'boolean' && finite(rangeM, 0, 60) && finite(openingDeg, 1, 180) &&
        finite(intensity, 0, 20) && finite(falloff, 0, 100) && finite(yawDeg, -180, 180) &&
        finite(pitchDeg, -90, 90) && Array.isArray(emitters) && emitters.length === 1, 'réglages de diffusion invalides');
    const { origin, axis } = emitters[0];
    check(vector(origin, 1) && origin.every((n, i) => approx(n, metadata.emissionPoint[i])) &&
        vector(axis, 1) && approx(Math.hypot(...axis), 1), 'repère de lentille différent du Studio');
    return { enabled, rangeM, openingDeg, intensity, falloff, emitters: [{ origin, axis }] };
}

function ghostPattern(animation, part, metadata, variant) {
    check(animation?.schema === 'tryagain.light-patterns' && animation.version === 2 &&
        animation.model === part.model && animation.revision === revision && animation.service === 'police' &&
        Array.isArray(animation.optics) && animation.optics.length === 2 && Array.isArray(animation.patterns),
        'animation ou modèle incompatible : ' + part.key);
    for (const [i, key] of ['rouge', 'bleu'].entries()) {
        const optic = animation.optics[i];
        check(optic?.id === i + 1 && same(optic.color, rgb[key]) && optic.overlay === metadata.colors[key] &&
            optic.enabled === (key === variant) && same(optic.emitters, [metadata.emissionPoint]),
            'canal, variante ou point optique incompatible : ' + part.key);
    }
    const active = animation.patterns.filter(pattern => pattern.id === animation.activeId);
    check(active.length === 1 && Array.isArray(active[0].steps) && active[0].steps.length > 0 &&
        active[0].steps.length <= 32, 'motif actif absent ou ambigu');
    let total = 0;
    const steps = active[0].steps.map(({ duration, levels }) => {
        check(Number.isInteger(duration) && duration >= 1 && duration <= 5000 &&
            Array.isArray(levels) && levels.length === 2 && levels.every(level => Number.isInteger(level) &&
                finite(level, 0, 100)), 'phase invalide');
        total += duration;
        return { duration, levels: [levels[variant === 'rouge' ? 0 : 1]] };
    });
    check(total <= 30000, 'motif trop long');
    return steps;
}

function compilePhantom(base, contents, studioContents, manifest) {
    const studio = JSON.parse(studioContents);
    const doc = JSON.parse(contents);
    const { project, kitFantome: kit } = doc;
    check(doc.schema === 'tryagain.vehicle-mount' && doc.version === 1 && project?.vehicle === 'phantom' &&
        same(doc.axes, { space: 'vehicle', position: 'metres', rotation: 'degrees', eulerOrder: 'ZXY',
            up: '+Z', forward: '+Y' }), 'export ou axes non pris en charge');
    check(studio.schema === 'tryagain.studio.ghost-lights' && studio.version === 1 && studio.revision === revision &&
        hash(studioContents) === studioSha && kit?.schema === 'tryagain.ghost-lighting' && kit.version === 1 &&
        kit.vehicle === 'phantom' && kit.revision === revision && kit.manifestSha256 === studioSha &&
        manifest.includes("data_file 'DLC_ITYP_REQUEST' 'stream/" + ytyp + "'"), 'révision Studio ou YTYP incompatible');
    check(Array.isArray(project.attachments) && project.attachments.length === 10 &&
        Array.isArray(kit.pieces) && kit.pieces.length === 10 && Array.isArray(doc.animationsLumieres) &&
        doc.animationsLumieres.length === 10 && Array.isArray(doc.diffusionsLentilles ?? []),
        'liste des pièces ou optiques invalide');
    const declarations = index(kit.pieces), animations = index(doc.animationsLumieres);
    const diffusions = index(doc.diffusionsLentilles ?? []);
    check(declarations.size === 10 && animations.size === 10 &&
        diffusions.size === (doc.diffusionsLentilles ?? []).length, 'déclaration en double');
    const used = new Set(), checkedAssets = new Set();
    const accessories = project.attachments.map(part => {
        const studioType = models.get(part.model);
        const declaration = declarations.get(part.key);
        const metadata = studio.parts[studioType];
        check(studioType && declaration?.model === part.model && declaration.type === studioType &&
            /^[a-z][a-z0-9_-]{0,47}$/.test(part.key) && !used.has(part.key) && Object.hasOwn(rgb, part.ghostColor) &&
            part.ghostColor === declaration.teinte && metadata.model === part.model &&
            vector(part.position, 6) && vector(part.rotation, 180) && same(part.position, declaration.position) &&
            same(part.rotation, declaration.rotation) && same(declaration.overlays, metadata.colors) &&
            declaration.projection === false, 'montage, variante ou pose invalide : ' + part.key);
        used.add(part.key);
        const assetSet = declaration.assets;
        const assets = [[assetSet.ydr, part.model + '.ydr'], [assetSet.ytyp, ytyp],
            ...['rouge', 'bleu'].map(c => [assetSet.overlays[c], metadata.colors[c] + '.ydr'])];
        for (const [asset, name] of assets) {
            const key = name + ':' + asset?.source + ':' + asset?.sha256;
            if (!checkedAssets.has(key)) { verifyAsset(base, asset, name); checkedAssets.add(key); }
        }
        return { id: part.key, name: metadata.label + (part.ghostColor === 'rouge' ? ' · rouge' : ' · bleu'),
            slot: part.key, kind: 'prop', model: part.model, position: xyz(part.position), rotation: xyz(part.rotation),
            zones: [{ id: 'centre', model: metadata.colors[part.ghostColor], color: tint(rgb[part.ghostColor]) }],
            ghostSteps: ghostPattern(animations.get(part.key), part, metadata, part.ghostColor),
            optics: { 'group:1': profile(diffusions.get(part.key), part.model, metadata) } };
    });
    check([...diffusions.keys()].every(key => used.has(key)) && checkedAssets.size === Object.keys(streamSha).length,
        'diffusion sans pièce ou modèles Studio manquants');
    const frise = fromExport(doc, registry);
    const timeline = bind(frise.timeline, new Map(accessories.map(part => [part.id, part.id])));
    return { preset: { id: 'phantom-police-lab-frise-v01', model: 'phantom', service: 'police',
        accessories, defaults: accessories.map(part => part.id),
        ...(timeline ? { timeline } : {}) },
        frise, exportSha256: hash(contents), studioSha256: studioSha };
}

function withPhantom(catalog, base, sourceFile) {
    check(!Object.hasOwn(catalog, 'phantom'), 'profil déjà présent');
    const compiled = compilePhantom(base, sourceFile(source + 'montage-phantom-frise-lumiere-v01.json'),
        sourceFile(source + 'geometry.json'), sourceFile('fxmanifest.lua'));
    return { ...compiled, catalog: { ...catalog, phantom: { police: compiled.preset } } };
}

module.exports = { compilePhantom, withPhantom, normalizePhantomDiffusion: profile };
