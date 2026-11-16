'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('./model-exports.js');
const { compilePhantomAtelierMount } = require('./phantom-atelier-4.js');
const { createProjectionView } = require('./projection-view.js');
const { mountedParts } = require('./installed-mounts.js');
const { compileChassisMount, drawable, tintId, rgb } = require('./chassis-optics.js');

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
    need(relative === path.normalize(file) && info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= maximum,
        `Pack : fichier absent, hors dossier ou trop grand (${file})`);
    return fs.readFileSync(absolute);
}

function legacyPack(base, spec, descriptor) {
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
    const tints = { rouge: [255, 12, 9], bleu: [24, 72, 255] };
    const geometry = json('presets/phantom-grand-format/geometry.json');
    const parts = new Map(Object.values(geometry.parts).map(part => [part.model, {
        revision: geometry.revision,
        tints: new Map(Object.entries(tints).map(([id, color]) => [id, { id, color, model: part.colors[id] }])),
    }]));
    return { id: rendererId, base, version: spec.version, resource: spec.resource, legacy: true,
        assets: models.flatMap(model => [model, ...[...parts.get(model).tints.values()].map(tint => tint.model)]),
        types: ['ta01_fantome_gf'], parts, profile: json(engine), registry: json(presets), bindings: calibration,
        sourceMountSha256: descriptor.sourceMountSha256, [slots]: true };
}

const plain = value => value && Object.getPrototypeOf(value) === Object.prototype;
const fields = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const streamName = /^stream\/(?:(?:ta01|celk)_[a-z0-9][a-z0-9_]{0,57}\.ydr|(?:ta01|celk|ta_pack)_[a-z0-9][a-z0-9_]{0,54}\.ytyp)$/;
const prose = value => typeof value === 'string' && value.length >= 1 && value.length <= 120 && !/[\x00-\x1f\x7f]/.test(value);

function streamDeclarations(contents, types, version) {
    const declarations = new Set();
    const typeFiles = new Set(), requested = new Set();
    for (const line of contents.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
        if (line.startsWith('--') && !line.startsWith('--[')) continue;
        const scalar = /^(fx_version|game|version|author|description) '([^'\\]+)'$/.exec(line);
        if (scalar) {
            need(!declarations.has(scalar[1]) && prose(scalar[2]), 'Déclaration FiveM répétée ou invalide');
            const expected = { fx_version: 'cerulean', game: 'gta5', version }[scalar[1]];
            need(expected === undefined || scalar[2] === expected, 'Déclaration FiveM incompatible : ' + scalar[1]);
            declarations.add(scalar[1]);
            continue;
        }
        const declaration = /^(file|data_file 'DLC_ITYP_REQUEST') '([^']+)'$/.exec(line);
        const target = declaration?.[1] === 'file' ? typeFiles : requested;
        need(declaration && types.has(declaration[2]) && !target.has(declaration[2]), 'Déclaration de flux FiveM invalide');
        target.add(declaration[2]);
    }
    need(['fx_version', 'game', 'version'].every(key => declarations.has(key)) &&
        typeFiles.size === types.size && requested.size === types.size, 'FXServer : inventaire YTYP incomplet');
}

function chassisPack(base, spec, descriptor) {
    need(fields(descriptor, ['schema', 'version', 'id', 'packVersion', 'author', 'studioRevision', 'renderer', 'files', 'parts']) &&
        descriptor.renderer === 'chassis-optics-v1' && prose(descriptor.author) && prose(descriptor.studioRevision) &&
        plain(descriptor.files) && Array.isArray(descriptor.parts) && descriptor.parts.length >= 1 &&
        descriptor.parts.length <= 128, 'Catalogue châssis v2 invalide');
    const entries = Object.entries(descriptor.files);
    need(entries.length <= 256 && entries.every(([key, hash]) => streamName.test(key) &&
        typeof hash === 'string' && shaPattern.test(hash)), 'Inventaire de flux invalide');
    const types = new Set(entries.map(([filename]) => filename).filter(name => name.endsWith('.ytyp')));
    need(types.size > 0 && types.size <= 16, 'Au moins un YTYP, au plus 16');
    const parts = new Map();
    const used = new Set();
    function asset(name) {
        const file = 'stream/' + name + '.ydr';
        need(typeof name === 'string' && drawable.test(name) && Object.hasOwn(descriptor.files, file) && !used.has(name),
            'Modèle/drawable d’optique absent, répété ou non réservé : ' + name);
        used.add(name);
    }
    for (const part of descriptor.parts) {
        need(fields(part, ['model', 'tints']) && Array.isArray(part.tints) && part.tints.length >= 1 && part.tints.length <= 8,
            'Pièce de catalogue invalide');
        asset(part.model);
        const tints = new Map();
        for (const row of part.tints) {
            need(fields(row, ['id', 'model', 'color']) && typeof row.id === 'string' && tintId.test(row.id) &&
                !tints.has(row.id) && rgb(row.color), 'Lentille de catalogue invalide');
            asset(row.model);
            tints.set(row.id, row);
        }
        parts.set(part.model, { tints });
    }
    need(used.size + types.size === entries.length, 'Flux non référencé par le catalogue');
    const stream = path.join(base, 'stream');
    need(fs.lstatSync(stream).isDirectory() && fs.realpathSync(stream) === stream &&
        JSON.stringify(fs.readdirSync(stream).sort()) === JSON.stringify(entries.map(([filename]) => path.posix.basename(filename)).sort()),
    'Flux inattendu dans le pack');
    streamDeclarations(regular(base, 'fxmanifest.lua', 8192).toString('utf8'), types, spec.version);
    let total = 0;
    for (const [filename, expected] of entries) {
        const bytes = regular(base, filename, 8 * 1024 * 1024);
        total += bytes.length;
        need(total <= 128 * 1024 * 1024 && bytes.toString('ascii', 0, 4) === 'RSC7' &&
            sha256(bytes) === expected, 'Empreinte, format GTA ou quota du pack invalide : ' + filename);
    }
    return { id: descriptor.id, version: spec.version, resource: spec.resource, parts, assets: [...used],
        types: [...types].map(file => path.posix.basename(file, '.ytyp')), [slots]: true };
}

function loadPack(baseDir, spec, id = rendererId) {
    need(typeof spec?.version === 'string' && typeof spec.sha256 === 'string' && shaPattern.test(spec.sha256),
        'Version ou empreinte de pack requise');
    const base = fs.realpathSync(baseDir);
    const file = regular(base, 'pack-manifest.json', 128 * 1024);
    need(sha256(file) === spec.sha256, 'Empreinte du manifeste du pack différente de la configuration');
    const descriptor = JSON.parse(file.toString('utf8'));
    need(descriptor?.schema === 'tryagain.piece-pack' && descriptor.id === id && descriptor.packVersion === spec.version,
        'Identité ou version du manifeste du pack incompatible');
    const legacy = descriptor.version === 1 && id === rendererId && spec.version === '0.1.0';
    need(legacy || descriptor.version === 2, 'Version du schéma de pack incompatible');
    return { ...(legacy ? legacyPack(base, spec, descriptor) : chassisPack(base, spec, descriptor)), sha256: spec.sha256 };
}

function compiler(registry, unavailable = new Map(), assertStarted = () => {}) {
    return ({ bytes, doc, model, service, packs }) => {
        const resolved = packs.map(requested => {
            const alias = requested.id === studioPackage.id && requested.version === studioPackage.version;
            const id = alias ? rendererId : requested.id;
            const pack = registry.get(id);
            need(pack?.[slots], `Pack ${requested.id}@${requested.version} indisponible : ${unavailable.get(id) ?? 'non configuré'}`);
            need(pack.version === (alias ? studioPackage.runtimeVersion : requested.version) && (!alias || pack.legacy),
                'Version de pack incompatible : ' + requested.id);
            assertStarted(pack);
            return pack;
        });
        need(new Set(resolved.map(pack => pack.id)).size === resolved.length, 'Même pack demandé par deux identités');
        const resources = resolved.flatMap(pack => pack.resource ? [pack.resource] : []);
        const dependencies = Object.fromEntries(resolved.map(pack => [pack.id + '@' + pack.version, pack.sha256]));
        if (doc?.kitFantomeGrandFormat === undefined) {
            return { ...compileChassisMount({ bytes, doc, model, service, packs: resolved }), resources, dependencies };
        }
        const [pack] = resolved;
        need(resolved.length === 1 && pack.legacy && model === 'phantom' && service === 'police',
            'Le montage historique Phantom Police demande son modèle et son pack exacts');
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
        return { parts, renderedParts, library: mount.library, resources, dependencies };
    };
}

module.exports = { loadPack, compiler, rendererId };
