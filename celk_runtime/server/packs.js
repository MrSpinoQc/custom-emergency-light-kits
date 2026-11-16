'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('./model-exports.js');
const { compilePhantomAtelierMount } = require('./phantom-atelier-4.js');
const { createProjectionView } = require('./projection-view.js');
const { mountedParts } = require('./installed-mounts.js');

const rendererId = 'phantom-grand-format';
// Raccord explicite de la remise Studio vérifiée. Le manifeste runtime reste
// vérifié séparément et garde une identité/version d’installation distinctes.
const studioPackage = { id: 'phantom-fantome', version: '0.1.0-candidat.1', runtimeVersion: '0.1.0' };
const models = ['ta01_fantome_lame_675', 'ta01_fantome_rect_250', 'ta01_fantome_rond_146', 'ta01_fantome_vitre_540'];
const streamFiles = ['stream/ta01_fantome_gf.ytyp', ...models.flatMap(model =>
    ['', '_red', '_blue'].map(suffix => `stream/${model}${suffix}.ydr`))];
const engine = 'projection/profil-moteur-centre-v2.json';
const presets = 'projection/profils-centre-r35-pour-moteur-v2.json';
const bindings = 'projection/liaisons-temoin-phantom-pour-moteur-v2.1.json';
const verifiedFiles = [...streamFiles, 'presets/phantom-grand-format/geometry.json', 'installation-limits.json', engine, presets, bindings];
const shaPattern = /^[a-f0-9]{64}$/;
const slots = Symbol('validatedKit');

function need(condition, message) {
    if (!condition) throw new Error(message);
}

function regular(base, file, maximum) {
    const absolute = path.resolve(base, file);
    const relative = path.relative(base, fs.realpathSync(absolute));
    const info = fs.lstatSync(absolute);
    need(relative === path.normalize(file) && info.isFile() && !info.isSymbolicLink() && info.size <= maximum,
        `Pack ${rendererId} : fichier absent, hors dossier ou trop grand (${file})`);
    return fs.readFileSync(absolute);
}

function loadPack(baseDir, spec) {
    need(typeof spec?.version === 'string' && spec.version === '0.1.0' &&
        typeof spec.sha256 === 'string' && shaPattern.test(spec.sha256), 'Version ou empreinte de pack requise');
    const base = fs.realpathSync(baseDir);
    const file = regular(base, 'pack-manifest.json', 48 * 1024);
    need(sha256(file) === spec.sha256, 'Empreinte du manifeste du pack différente de la configuration');
    const descriptor = JSON.parse(file.toString('utf8'));
    need(descriptor?.schema === 'tryagain.piece-pack' && descriptor.version === 1 && descriptor.id === rendererId &&
        descriptor.packVersion === spec.version && descriptor.studioRevision === 'DEV-01-TA01-PHANTOM-GRAND-FORMAT-v01' &&
        descriptor.author === 'Spino', 'Manifeste ou révision Studio incompatibles');
    need(descriptor.files && Object.keys(descriptor.files).length === verifiedFiles.length &&
        verifiedFiles.every(name => Object.hasOwn(descriptor.files, name)), 'Inventaire du pack incomplet');
    const streamed = fs.readdirSync(path.join(base, 'stream'));
    need(streamed.length === streamFiles.length && streamed.every(name => streamFiles.includes(`stream/${name}`)), 'Flux inattendu dans le pack');
    const files = new Map();
    for (const name of verifiedFiles) {
        const bytes = regular(base, name, 8 * 1024 * 1024);
        need(sha256(bytes) === descriptor.files[name], `Empreinte du pack différente : ${name}`);
        files.set(name, bytes);
    }
    const limits = JSON.parse(files.get('installation-limits.json'));
    const runtime = require('../installation-limits.json');
    need(limits.schema === runtime.schema && limits.version === runtime.version &&
        limits.maxAccessoriesPerVehicle === runtime.maxAccessoriesPerVehicle, 'Plafonds du pack et du script différents');
    const manifest = regular(base, 'fxmanifest.lua', 8192).toString('utf8');
    need(manifest.includes(`version '${spec.version}'`) &&
        manifest.includes("data_file 'DLC_ITYP_REQUEST' 'stream/ta01_fantome_gf.ytyp'"), 'Déclaration FiveM du pack incompatible');
    const json = name => JSON.parse(files.get(name));
    const calibration = json(bindings);
    need(typeof descriptor.sourceMountSha256 === 'string' && shaPattern.test(descriptor.sourceMountSha256) &&
        typeof descriptor.runtimeMountSha256 === 'string' && shaPattern.test(descriptor.runtimeMountSha256) &&
        descriptor.runtimeMountSha256 === calibration.exportSha256, 'Empreinte du montage de calibration incohérente');
    return { base, version: spec.version, profile: json(engine), registry: json(presets), bindings: calibration,
        sourceMountSha256: descriptor.sourceMountSha256, [slots]: true };
}

function compiler(registry) {
    return ({ bytes, model, service, packs }) => {
        need(model === 'phantom' && service === 'police', 'Montage réseau non pris en charge par le pack Phantom Police');
        need(packs.length === 1, 'Pack de pièces Phantom obligatoire');
        const pack = registry.get(rendererId);
        const requested = packs[0];
        const matchesRuntime = requested.id === rendererId && requested.version === pack?.version;
        const matchesStudio = requested.id === studioPackage.id && requested.version === studioPackage.version &&
            pack?.version === studioPackage.runtimeVersion;
        need(pack?.[slots] && (matchesRuntime || matchesStudio), 'Pack absent ou version incompatible');
        const mount = compilePhantomAtelierMount(pack.base, bytes);
        const parts = mount.preset.accessories;
        // The calibration is bound to the exact authored export. Other variants
        // keep their own source layout and use the same versioned engine profile.
        // Le reçu d’équivalence lie deux entrées précises : auteur historique
        // et version épurée. Une autre empreinte garde la conversion normale.
        const calibrated = mount.sha === pack.bindings.exportSha256 || mount.sha === pack.sourceMountSha256;
        const references = [{ parts, exportSha256: mount.sha,
            ...(calibrated ? { registry: pack.registry, bindings: { ...pack.bindings, exportSha256: mount.sha } } : {}),
            exposedFaceNormalLocal: [0, 1, 0] }];
        const renderedParts = createProjectionView({ profile: pack.profile, references }).parts(parts, mount.sha);
        mountedParts({ renderedParts }, parts.map(part => part.id));
        return { parts, renderedParts, library: mount.library };
    };
}

module.exports = { loadPack, compiler, rendererId };
