'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isDeepStrictEqual: same } = require('node:util');
const { normalizePhantomDiffusion } = require('./phantom-frise.js');
const { approvedPhantomParts, compileLightScenes } = require('./light-scenes.js');
const { resolveProjectionSources } = require('./projection-sources.js');

const folder = 'presets/phantom-grand-format/';
const hash = content => createHash('sha256').update(content).digest('hex');
const exportSha = '81e161911398d6662e5dd51af2ccb4fe5976e2f61df6758e565a899b1712a394';
const studioSha = '91a1369008e6c6c60deab1f4756bebc085b132e2d979304af92570a34a732759';
const xyz = ([x, y, z]) => ({ x, y, z });
const colors = { rouge: [255, 12, 9], bleu: [24, 72, 255] };
const ytyp = 'stream/ta01_fantome_gf.ytyp';

function demand(condition, message) {
    if (!condition) throw new Error('Phantom Atelier (4) · ' + message);
}

function rowsByKey(rows) {
    demand(Array.isArray(rows) && rows.every(row => row && typeof row.pieceKey === 'string'), 'registre de pièces invalide');
    const entries = new Map(rows.map(row => [row.pieceKey, row]));
    demand(entries.size === rows.length, 'clé répétée');
    return entries;
}

function compilePhantomAtelierMount(base, contents) {
    const geometry = readFileSync(join(base, folder, 'geometry.json'));
    demand(hash(geometry) === studioSha, 'empreinte Studio inattendue');
    const doc = JSON.parse(contents);
    const studio = JSON.parse(geometry);
    const kit = doc.kitFantomeGrandFormat;
    const limits = JSON.parse(readFileSync(join(base, 'installation-limits.json'), 'utf8'));
    const attachments = doc.project?.attachments;
    demand(kit?.manifestSha256 === studioSha && kit.revision === studio.revision && kit.vehicle === 'phantom', 'révision invalide');
    demand(Array.isArray(attachments) && attachments.length > 0 && attachments.length <= limits.maxAccessoriesPerVehicle,
        'nombre de pièces hors limite');
    demand(readFileSync(join(base, 'fxmanifest.lua'), 'utf8').includes(`data_file 'DLC_ITYP_REQUEST' '${ytyp}'`), 'YTYP non déclaré');
    const declared = rowsByKey(kit.pieces);
    const animations = rowsByKey(doc.animationsLumieres);
    const diffusions = rowsByKey(doc.diffusionsLentilles);
    const models = new Map(Object.values(studio.parts).map(part => [part.model, part]));
    const assets = new Map();

    function verify(proof, fileName) {
        demand(proof?.source === fileName, 'source différente : ' + fileName);
        if (!assets.has(fileName)) {
            const bytes = readFileSync(join(base, fileName));
            demand(bytes.toString('ascii', 0, 4) === 'RSC7', 'actif GTA illisible : ' + fileName);
            assets.set(fileName, hash(bytes));
        }
        demand(assets.get(fileName) === proof.sha256, 'empreinte différente : ' + fileName);
    }

    const used = new Set();
    const authoredAccessories = attachments.map(part => {
        demand(part && typeof part.key === 'string', 'pièce exportée invalide');
        const key = part.key;
        const row = declared.get(key);
        const metadata = models.get(part.model);
        const animation = animations.get(key);
        const colorIndex = part.ghostColor === 'rouge' ? 0 : 1;
        demand(/^[a-z0-9][a-z0-9_.-]{0,63}$/.test(key) && !used.has(key) && metadata && row?.model === part.model &&
            row?.type === metadata.kind && row.teinte === part.ghostColor && Object.hasOwn(colors, part.ghostColor) &&
            Array.isArray(part.position) && part.position.length === 3 &&
            part.position.every(coordinate => Number.isFinite(coordinate) && Math.abs(coordinate) <= 6) &&
            Array.isArray(part.rotation) && part.rotation.length === 3 &&
            part.rotation.every(angle => Number.isFinite(angle) && Math.abs(angle) <= 180) &&
            same(part.position, row.position) && same(part.rotation, row.rotation) &&
            same(row.overlays, metadata.colors) && row.projection === false &&
            animation?.model === part.model && animation.revision === studio.revision &&
            Array.isArray(animation.optics) && animation.optics.length === 2 && Array.isArray(animation.patterns),
            'pièce ou pose invalide : ' + key);
        used.add(key);
        verify(row.assets.ydr, 'stream/' + part.model + '.ydr');
        verify(row.assets.ytyp, ytyp);
        for (const [index, name] of Object.keys(colors).entries()) {
            const optic = animation.optics[index];
            demand(optic?.id === index + 1 && same(optic.color, colors[name]) && optic.overlay === metadata.colors[name] &&
                same(optic.emitters, [metadata.emissionPoint]) && optic.enabled === (index === colorIndex), 'optique différente : ' + key);
            verify(row.assets.overlays[name], 'stream/' + optic.overlay + '.ydr');
        }
        const pattern = animation.patterns.filter(entry => entry.id === animation.activeId);
        demand(pattern.length === 1 && pattern[0].steps.length > 0, 'motif actif absent : ' + key);
        const steps = pattern[0].steps.map(({ duration, levels }) => ({ duration, levels: [levels[colorIndex]] }));
        const [r, g, b] = colors[part.ghostColor];
        return { id: key, slot: key, name: metadata.label, kind: 'prop', model: part.model,
            position: xyz(part.position), rotation: xyz(part.rotation), ghostSteps: steps,
            zones: [{ id: 'centre', model: metadata.colors[part.ghostColor], color: { r, g, b } }],
            optics: { 'group:1': normalizePhantomDiffusion(diffusions.get(key), part.model, metadata, studio.revision) } };
    });
    demand(declared.size === used.size && animations.size === used.size &&
        [...diffusions.keys()].every(key => used.has(key)), 'montage ou jeu de modèles incomplet');

    // The exported scenes already bind the replacement step. The editing group still references the old piece.
    const accessories = resolveProjectionSources(authoredAccessories, doc);
    const library = compileLightScenes(contents.toString('utf8'), 'phantom', approvedPhantomParts({ accessories }));
    const preset = { id: 'phantom-police-atelier-4', accessories, defaults: accessories.map(part => part.id) };
    return { library, sha: hash(contents), assetCount: assets.size, preset, catalogue: { phantom: { police: preset } } };
}

function loadPhantomAtelier4(base) {
    const contents = readFileSync(join(base, folder, 'montage-phantom-atelier-4.json'));
    demand(hash(contents) === exportSha, 'empreinte du témoin inattendue');
    const mount = compilePhantomAtelierMount(base, contents);
    demand(mount.preset.accessories.length === 14 && mount.assetCount === 13, 'témoin incomplet');
    return mount;
}

module.exports = { loadPhantomAtelier4, compilePhantomAtelierMount };
