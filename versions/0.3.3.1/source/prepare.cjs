'use strict';

// Offline preparation only. This module has no process-launch or FiveM-command API.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { TextDecoder } = require('node:util');
const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'runtime/celk_runtime');
const ADMIN = path.join(ROOT, 'admin/celk_admin');
const PROFILE_GROUP = '[celk-profile]';
const { readConfig } = require('./runtime/celk_runtime/server/runtime-config.js');
const { loadPack, compiler } = require('./runtime/celk_runtime/server/packs.js');
const { createActivation } = require('./runtime/celk_runtime/server/activation.js');
const decoder = new TextDecoder('utf-8', { fatal: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const object = value => value && Object.getPrototypeOf(value) === Object.prototype;
const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(value) &&
    !value.endsWith('.') && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value);
const need = (condition, reason) => { if (!condition) throw new Error(reason); };
const exists = file => { try { return fs.lstatSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const json = file => JSON.parse(decoder.decode(read(file, 2 * 1024 * 1024)));

function inside(parent, target) {
    const rel = path.relative(parent, target);
    return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

function normal(file) {
    const absolute = path.resolve(file);
    let cursor = path.parse(absolute).root;
    for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
        cursor = path.join(cursor, part);
        const info = fs.lstatSync(cursor);
        need(!info.isSymbolicLink(), 'Lien symbolique/jonction interdit : ' + cursor);
    }
    need(path.resolve(fs.realpathSync(absolute)).toLowerCase() === absolute.toLowerCase(), 'Chemin redirigé : ' + absolute);
    return fs.lstatSync(absolute);
}

function read(file, max = 8 * 1024 * 1024, allowEmpty = false) {
    const before = normal(file);
    need(before.isFile() && (allowEmpty || before.size > 0) && before.size <= max, 'Fichier normal/quota requis : ' + file);
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = fs.fstatSync(fd);
        need(opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size, 'Fichier remplacé : ' + file);
        const bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
            const count = fs.readSync(fd, bytes, offset, bytes.length - offset, null);
            need(count > 0, 'Lecture incomplète : ' + file);
            offset += count;
        }
        need(fs.readSync(fd, Buffer.alloc(1), 0, 1, null) === 0, 'Fichier agrandi pendant lecture : ' + file);
        const after = fs.fstatSync(fd);
        const named = normal(file);
        need(bytes.length === opened.size && after.mtimeMs === opened.mtimeMs && after.size === opened.size &&
            named.ino === opened.ino && named.dev === opened.dev && named.mtimeMs === opened.mtimeMs,
        'Mutation pendant lecture : ' + file);
        return bytes;
    } finally { fs.closeSync(fd); }
}

function filename(value) {
    return value.length <= 192 && value !== '.' && value !== '..' && !/[<>:"/\\|?*\x00-\x1f]/.test(value) &&
        !/[. ]$/.test(value) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value);
}

function tree(source, target, allowEmpty = () => false) {
    need(normal(source).isDirectory(), 'Dossier normal requis : ' + source);
    const records = [];
    let total = 0, count = 0;
    function walk(folder, rel, depth) {
        need(depth <= 12, 'Profondeur de dossier dépassée');
        const names = fs.readdirSync(folder).sort();
        need(names.length <= 4096, 'Trop de fichiers dans un dossier');
        need(new Set(names.map(n => n.toLowerCase())).size === names.length, 'Collision de casse de chemins');
        for (const name of names) {
            need(filename(name) && ++count <= 4096, 'Nom de fichier invalide ou trop de fichiers');
            const file = path.join(folder, name), relative = rel ? rel + '/' + name : name;
            const info = normal(file);
            if (info.isDirectory()) {
                if (target) fs.mkdirSync(path.join(target, ...relative.split('/')), { recursive: true });
                records.push([relative + '/', null]);
                walk(file, relative, depth + 1);
            } else {
                const bytes = read(file, undefined, allowEmpty(relative));
                total += bytes.length;
                need(total <= 512 * 1024 * 1024, 'Quota de dossier dépassé');
                records.push([relative, hash(bytes)]);
                if (target) writeNew(path.join(target, ...relative.split('/')), bytes);
            }
        }
    }
    if (target) { writable(target); fs.mkdirSync(target, { recursive: true }); normal(target); }
    walk(source, '', 0);
    return { digest: hash(Buffer.from(JSON.stringify(records))), records, total };
}

function writable(target) {
    need(inside(ROOT, path.resolve(target)) && path.resolve(target) !== ROOT, 'Écriture hors prototype interdite');
    let parent = path.dirname(path.resolve(target));
    while (!exists(parent)) parent = path.dirname(parent);
    need(normal(parent).isDirectory(), 'Parent de sortie invalide');
}

function writeNew(file, bytes) {
    writable(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    normal(path.dirname(file));
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
const encoded = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
function declaredComposition(doc) {
    // Delivery revision and the storage path of an identical mount are not content.
    // Both documents still undergo the native reader's full checks before reuse.
    return hash(encoded({ schema: doc.schema, version: doc.version, model: doc.model, publisher: doc.publisher,
        configurations: doc.configurations.map(spec => ({ id: spec.id, service: spec.service, label: spec.label,
            mount: spec.mount.sha256, packs: spec.packs.map(pack => [pack.id, pack.version])
                .sort(([a], [b]) => a.localeCompare(b)) })).sort((a, b) => a.id.localeCompare(b.id)) }));
}
function compiledComposition(release) {
    return hash(encoded({ model: release.model, publisher: release.publisher,
        variants: [...release.variants.values()].map(variant => ({ id: variant.id, service: variant.service,
            label: variant.label, mount: variant.mountSha256,
            dependencies: Object.entries(variant.dependencies).sort(([a], [b]) => a.localeCompare(b)) }))
            .sort((a, b) => a.id.localeCompare(b.id)) }));
}
function replace(file, bytes) {
    const temporary = path.join(path.dirname(file), '.write-' + randomUUID());
    writeNew(temporary, bytes);
    if (exists(file)) need(normal(file).isFile(), 'Cible de remplacement invalide');
    fs.renameSync(temporary, file);
}

// GTA's case-insensitive Jenkins hash, used only for offline collision detection.
function joaat(value) {
    let h = 0;
    for (const c of Buffer.from(value.toLowerCase())) { h = (h + c) >>> 0; h = (h + (h << 10)) >>> 0; h ^= h >>> 6; }
    h = (h + (h << 3)) >>> 0; h ^= h >>> 11; return (h + (h << 15)) >>> 0;
}

function version() {
    const match = /^version '([^']+)'$/m.exec(read(path.join(TEMPLATE, 'fxmanifest.lua')).toString('utf8'));
    need(match, 'Version lecteur absente');
    return match[1];
}

function policyAt(home) {
    const policy = json(path.join(home, 'policy.json'));
    need(object(policy) && Object.keys(policy).length === 3 && policy.schema === 'tryagain.folder-admission' &&
        policy.version === 1 && Array.isArray(policy.trustedLocalPublishers) && policy.trustedLocalPublishers.length <= 128 &&
        policy.trustedLocalPublishers.every(id) && new Set(policy.trustedLocalPublishers).size === policy.trustedLocalPublishers.length,
    'Politique locale v1 invalide');
    return policy;
}

function configAt(base, cfg) {
    const file = path.join(base, 'local/celk.config.json');
    replace(file, encoded(cfg));
    return readConfig(base, { name: 'celk_runtime', hash: joaat });
}

function canonicalResource(source, target, spec) {
    // loadPack parses the input Lua through its restrictive data-only grammar; never executes it.
    loadPack(source, spec, spec.id);
    const descriptor = json(path.join(source, 'pack-manifest.json'));
    fs.mkdirSync(target, { recursive: true }); normal(target);
    for (const file of ['pack-manifest.json', ...Object.keys(descriptor.files)]) {
        const destination = path.resolve(target, file);
        need(inside(target, destination), 'Chemin du catalogue hors ressource');
        writeNew(destination, read(path.join(source, file)));
    }
    const types = Object.keys(descriptor.files).filter(file => file.endsWith('.ytyp')).sort();
    need(types.length > 0, 'Pack sans YTYP');
    const lua = ["fx_version 'cerulean'", "game 'gta5'", `version '${spec.version}'`,
        ...types.flatMap(file => [`file '${file}'`, `data_file 'DLC_ITYP_REQUEST' '${file}'`]), ''].join('\n');
    replace(path.join(target, 'fxmanifest.lua'), Buffer.from(lua));
    loadPack(target, spec, spec.id);
}

function currentAt(home) {
    const file = path.join(home, 'CURRENT');
    if (!exists(file)) return null;
    const name = read(file, 128).toString('utf8').trim();
    need(/^g-[a-f0-9-]{36}$/.test(name), 'Pointeur CURRENT invalide');
    const folder = path.join(home, 'generations', name);
    normal(folder);
    const receipt = json(path.join(folder, 'receipt.json'));
    need(receipt.schema === 'tryagain.folder-generation' && receipt.version === 1, 'Reçu de génération incompatible');
    return { name, folder, receipt };
}

function resourceRecords(folder) {
    return tree(path.join(folder, 'resources'), undefined, name => name.startsWith(PROFILE_GROUP + '/')).records
        .filter(([name]) => !name.startsWith('celk_runtime/local/') && name !== 'celk_runtime/local/');
}

function profileList(entries) {
    need(Array.isArray(entries) && entries.length <= 64 && entries.every(entry =>
        object(entry) && Object.keys(entry).length === 3 && typeof entry.name === 'string' &&
        /^[A-Za-z0-9_-]{1,64}$/.test(entry.name) && id(entry.name.toLowerCase()) &&
        !/^celk_(?:runtime$|admin$|pack_)/i.test(entry.name) &&
        typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256) &&
        ['beforeRuntime', 'afterRuntime'].includes(entry.stage)
    ), 'Liste des ressources du profil de démarrage invalide');
    need(new Set(entries.map(entry => entry.name.toLowerCase())).size === entries.length, 'Ressource de profil dupliquée');
    return entries;
}

function stageProfile(home, staging) {
    const spec = path.join(home, 'startup-profile.json');
    if (!exists(spec)) return null;
    const bytes = read(spec, 16384);
    const profile = JSON.parse(decoder.decode(bytes));
    need(object(profile) && Object.keys(profile).length === 3 && profile.schema === 'celk.startup-profile' &&
        profile.version === 1, 'Profil de démarrage v1 invalide');
    const entries = profileList(profile.resources);
    for (const entry of entries) {
        const source = path.join(home, 'startup-resources', entry.name);
        const target = path.join(staging, 'resources', PROFILE_GROUP, entry.name);
        const manifest = ['fxmanifest.lua', '__resource.lua'].find(file => exists(path.join(source, file)));
        need(manifest && read(path.join(source, manifest)).length, 'Manifeste de profil absent : ' + entry.name);
        need(tree(source, target, () => true).digest === entry.sha256, 'Empreinte de profil modifiée : ' + entry.name);
    }
    return { entries, digest: hash(bytes) };
}

function checkProfileUnchanged(home, profile) {
    const spec = path.join(home, 'startup-profile.json');
    const digest = exists(spec) ? hash(read(spec, 16384)) : undefined;
    need(digest === profile?.digest, 'Le profil de démarrage a changé pendant la préparation');
}

function startOrder(resources, withAdmin) {
    const profile = profileList(resources ?? []);
    const before = profile.filter(entry => entry.stage === 'beforeRuntime').map(entry => entry.name);
    const after = profile.filter(entry => entry.stage === 'afterRuntime').map(entry => entry.name);
    const order = [...before, '[celk-packs]', 'celk_runtime', ...after, ...(withAdmin ? ['celk_admin'] : [])];
    return order.map(name => 'ensure ' + name + '\n').join('');
}

function verifyGeneration(current) {
    const { folder, receipt } = current;
    const code = path.join(folder, 'resources/celk_runtime');
    // Runtime local state can change while playing. Code, config, resources and inbox cannot.
    const records = resourceRecords(folder);
    need(hash(Buffer.from(JSON.stringify(records))) === receipt.resourcesDigest, 'Génération altérée : ressources/code');
    need(hash(read(path.join(code, 'local/celk.config.json'))) === receipt.configDigest, 'Configuration générée altérée');
    need(read(path.join(folder, 'start-order.cfg'), 8192).toString('utf8') ===
        startOrder(receipt.startupResources, Boolean(receipt.adminDigest)), 'Ordre de démarrage généré altéré');
    tree(path.join(code, 'local'));
    return code;
}

function readAdminSelection(home) {
    const file = path.join(home, 'selection-admin.json');
    let bytes;
    try { bytes = read(file, 16384); }
    catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
    const selection = JSON.parse(bytes.toString('utf8'));
    need(object(selection) && Object.keys(selection).length === 3 &&
        selection.schema === 'celk.admin-selection' && selection.version === 1 &&
        Array.isArray(selection.selected) && selection.selected.length <= 128 &&
        selection.selected.every(id) && new Set(selection.selected).size === selection.selected.length,
    'Sélection administrateur invalide');
    return { selected: selection.selected.sort(), digest: hash(bytes) };
}

function prepare({ home, beforeCommit, withAdmin = false } = {}) {
    home = path.resolve(home || path.join(ROOT, 'demo'));
    writable(home);
    need(normal(home).isDirectory(), 'Instance absente');
    const lock = path.join(home, '.prepare.lock');
    const fd = fs.openSync(lock, 'wx', 0o600);
    let staging;
    try {
        const policy = policyAt(home), runtimeVersion = version();
        const previous = currentAt(home);
        const previousRuntime = previous && verifyGeneration(previous);
        let admin = readAdminSelection(home);
        if (withAdmin && !admin) {
            const selected = previous ? [...new Set(previous.receipt.accepted.map(entry => entry.name))].sort() : [];
            writeNew(path.join(home, 'selection-admin.json'), encoded({ schema: 'celk.admin-selection', version: 1, selected }));
            admin = readAdminSelection(home);
        }
        const selected = admin && new Set(admin.selected);
        const checkAdminUnchanged = () => {
            need(readAdminSelection(home)?.digest === admin?.digest, 'La sélection administrateur a changé pendant la préparation');
        };
        const generations = path.join(home, 'generations');
        fs.mkdirSync(generations, { recursive: true }); normal(generations);
        staging = path.join(generations, '.pending-' + randomUUID());
        fs.mkdirSync(staging); normal(staging);
        const runtime = path.join(staging, 'resources/celk_runtime');
        const codeDigest = tree(TEMPLATE, runtime).digest;
        const adminDigest = withAdmin ? tree(ADMIN, path.join(staging, 'resources/celk_admin')).digest : null;
        const profile = stageProfile(home, staging);
        const reservedResources = new Set(['celk_runtime', 'celk_admin',
            ...(profile?.entries ?? []).map(entry => entry.name.toLowerCase())]);
        const local = path.join(runtime, 'local');
        const legacyBase = path.join(home, 'legacy/celk_runtime');
        const legacyConfig = path.join(legacyBase, 'local/celk.config.json');
        const cfg = exists(legacyConfig) ? json(legacyConfig) : { version: 1, scopes: {}, packs: {} };
        const legacyDigest = exists(path.join(home, 'legacy')) ? tree(path.join(home, 'legacy')).digest : null;
        const stateSource = previousRuntime ? path.join(previousRuntime, 'local') : path.join(legacyBase, 'local');
        if (exists(stateSource)) tree(stateSource, local); else fs.mkdirSync(local);
        if (!exists(path.join(local, 'install-sets'))) fs.mkdirSync(path.join(local, 'install-sets'));
        const settings = configAt(runtime, cfg);
        const registry = new Map(), packSpecs = new Map(), packSources = new Map(), claims = new Map();
        const env = { hash: joaat, name: 'celk_runtime' };
        function reserve(spec, pack) {
            for (const [kind, values] of [['YDR', pack.assets], ['YTYP', pack.types]]) for (const value of values) {
                const key = kind + ':' + joaat(value);
                const owner = claims.get(key);
                need(!owner || owner.id === spec.id, `Collision ${kind} avec ${owner?.id}: ${value}`);
            }
        }
        function remember(spec, pack, source) {
            registry.set(spec.id, pack); packSpecs.set(spec.id, spec); packSources.set(spec.id, source);
            for (const [kind, values] of [['YDR', pack.assets], ['YTYP', pack.types]]) for (const value of values)
                claims.set(kind + ':' + joaat(value), { id: spec.id, value });
        }
        for (const [id, entry] of settings.packs) {
            const spec = { id, ...entry }, source = path.join(home, 'legacy/resources', spec.resource);
            need(!reservedResources.has(spec.resource.toLowerCase()), 'Nom de ressource réservé par le profil : ' + spec.resource);
            normal(source); tree(source);
            const pack = loadPack(source, spec, id); reserve(spec, pack); remember(spec, pack, source);
        }
        const indexFile = path.join(local, 'active-models.json');
        let index = exists(indexFile) ? json(indexFile) : { schema: 'tryagain.model-activation', version: 2,
            models: {}, history: {}, retired: {}, packHashes: {} };
        // Native validation before touching any copied index, including v1 index migration in memory.
        createActivation({ root: local, scopes: cfg.scopes, compileMount: compiler(registry), runtimeVersion,
            configuredPacks: new Map(settings.packs) }).indexed();
        if (index.version === 1) index = { ...index, version: 2, retired: {}, packHashes: {} };
        const initialIndex = structuredClone(index);
        const incoming = path.join(home, 'packs'); normal(incoming);
        const names = fs.readdirSync(incoming).sort();
        need(names.length <= 128, 'Trop de dossiers entrants');
        const candidates = [], reports = [], sourceDigests = [];
        for (const name of names) {
            if (selected && !selected.has(name)) continue;
            try {
                need(id(name), 'Nom de dossier entrant invalide');
                const snapshot = path.join(staging, 'quarantine', name);
                const inventory = tree(path.join(incoming, name), snapshot);
                sourceDigests.push([name, inventory.digest]);
                const children = fs.readdirSync(snapshot);
                let set = snapshot;
                if (!exists(path.join(set, 'installation.json'))) {
                    need(children.length === 1 && id(children[0]), 'Racine ensemble absente ou ambiguë');
                    set = path.join(snapshot, children[0]); normal(set);
                }
                const envelope = json(path.join(set, 'installation.json'));
                const selection = json(path.join(set, 'selection/selection.celk'));
                need(id(selection.model) && id(selection.publisher), 'Modèle ou provenance invalide');
                need(policy.trustedLocalPublishers.includes(selection.publisher), 'Provenance non admise par la politique locale');
                need(!Object.hasOwn(cfg.scopes, selection.model), 'Modèle réservé à la configuration v1 explicite');
                need(Array.isArray(envelope.packs) && envelope.packs.length > 0 && envelope.packs.length <= 32, 'Dépendances absentes/quota');
                const prior = previous?.receipt.accepted.find(entry => entry.name === name && entry.digest === inventory.digest);
                candidates.push({ name, digest: inventory.digest, set, envelope, selection, prior: Boolean(prior) });
            } catch (error) { reports.push({ name, status: 'refused', reason: error.message }); }
        }
        const sourceDigest = hash(encoded(sourceDigests));
        const preparerDigest = hash(read(__filename));
        const signature = hash(encoded({ sourceDigest, codeDigest, preparerDigest, policy, legacyDigest,
            ...(admin ? { selected: admin.selected } : {}), ...(withAdmin ? { adminDigest } : {}),
            ...(profile ? { startupDigest: profile.digest } : {}) }));
        if (previous?.receipt.signature === signature && reports.length === 0) {
            // The previous generation is pinned and has just been verified. Native load checks archives again.
            const pcfg = json(path.join(previousRuntime, 'local/celk.config.json'));
            const pregistry = new Map(Object.entries(pcfg.packs).map(([id, spec]) => [id,
                loadPack(path.join(previous.folder, 'resources/[celk-packs]', spec.resource), spec, id)]));
            const ready = createActivation({ root: path.join(previousRuntime, 'local'), scopes: pcfg.scopes,
                compileMount: compiler(pregistry), runtimeVersion, configuredPacks: new Map(Object.entries(pcfg.packs)) }).loadReady();
            need(ready.refused.size === 0, 'État actif précédent invalide');
            checkAdminUnchanged();
            checkProfileUnchanged(home, profile);
            return { changed: false, generation: previous.name, folder: previous.folder, activeModels: [...ready.ready.keys()],
                reports: previous.receipt.reports, accepted: previous.receipt.accepted,
                reusedSelections: previous.receipt.reusedSelections ?? [] };
        }
        const managed = new Set(previous?.receipt.managedModels ?? []);
        const automaticRetired = new Set(previous?.receipt.removedModels ?? []);
        const manualRetired = new Set([...managed].filter(model => Object.hasOwn(index.retired, model) && !automaticRetired.has(model)));
        for (const model of managed) {
            delete index.models[model];
            if (automaticRetired.has(model)) delete index.retired[model];
        }
        replace(indexFile, encoded(index));
        const accepted = [], scopes = { ...cfg.scopes }, models = new Map(settings.models), importedNames = new Set();
        candidates.sort((a, b) => Number(b.prior) - Number(a.prior) || a.name.localeCompare(b.name));
        for (const candidate of candidates) {
            const before = read(indexFile);
            try {
                const { model, publisher } = candidate.selection;
                need(!manualRetired.has(model), 'Modèle retiré explicitement : restauration manuelle requise');
                const modelHash = joaat(model);
                need(modelHash && (!models.has(modelHash) || models.get(modelHash) === model), 'Collision empreinte GTA du modèle');
                need(!Object.hasOwn(scopes, model) || scopes[model] === publisher, 'Conflit de provenance du modèle');
                const nextRegistry = new Map(registry), nextSpecs = new Map(packSpecs), fresh = [];
                for (const spec of candidate.envelope.packs) {
                    const source = path.join(candidate.set, 'resources', spec.resource || '');
                    need(id(spec.id) && typeof spec.resource === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(spec.resource), 'Identité pack/ressource invalide');
                    need(!reservedResources.has(spec.resource.toLowerCase()), 'Nom de ressource réservé par le profil : ' + spec.resource);
                    const proposed = { version: 1, scopes: { ...scopes, [model]: publisher },
                        packs: Object.fromEntries([...nextSpecs].map(([id, p]) => [id, { resource: p.resource, version: p.version, sha256: p.sha256 }])) };
                    proposed.packs[spec.id] = { resource: spec.resource, version: spec.version, sha256: spec.sha256 };
                    configAt(runtime, proposed); // Uses v1 limits, semver, reserved names and hash checks.
                    normal(source); tree(source);
                    const pack = loadPack(source, spec, spec.id);
                    const old = nextSpecs.get(spec.id);
                    need(!old || (old.version === spec.version && old.sha256 === spec.sha256 && old.resource === spec.resource), 'Conflit identité/version/empreinte de pack');
                    for (const other of nextSpecs.values()) need(other.id === spec.id || other.resource.toLowerCase() !== spec.resource.toLowerCase(), 'Collision de nom de ressource');
                    reserve(spec, pack);
                    // Also compare packs declared within this same incoming ensemble.
                    for (const row of fresh) for (const [kind, values] of [['YDR', pack.assets], ['YTYP', pack.types]])
                        need(row.spec.id === spec.id || !values.some(value => row.pack[kind === 'YDR' ? 'assets' : 'types'].some(v => joaat(v) === joaat(value))), 'Collision de flux dans ensemble');
                    nextRegistry.set(spec.id, pack); nextSpecs.set(spec.id, spec); fresh.push({ spec, pack, source });
                }
                const setName = 'auto-' + candidate.digest.slice(0, 48);
                const setTarget = path.join(local, 'install-sets', setName);
                importedNames.add(setName);
                if (!exists(setTarget)) tree(candidate.set, setTarget);
                const reader = createActivation({ root: local, scopes: { ...scopes, [model]: publisher },
                    compileMount: compiler(nextRegistry), runtimeVersion,
                    configuredPacks: new Map([...nextSpecs].map(([id, p]) => [id, { resource: p.resource, version: p.version, sha256: p.sha256 }])) });
                const plan = reader.previewInstallSet(setName);
                const installed = reader.installSet(setName, plan.token);
                for (const row of fresh) remember(row.spec, row.pack, row.source);
                scopes[model] = publisher; models.set(modelHash, model); managed.add(model);
                accepted.push({ name: candidate.name, digest: candidate.digest, model, publisher, packs: candidate.envelope.packs, variants: candidate.selection.configurations.length });
                reports.push({ name: candidate.name, status: installed.added ? 'installed' : 'unchanged', model, added: installed.added, kept: installed.kept });
            } catch (error) {
                need(before.equals(read(indexFile)), 'Issue incertaine après écriture native : génération abandonnée');
                reports.push({ name: candidate.name, status: 'refused', reason: error.message });
            }
        }
        if (selected) {
            const included = new Set(accepted.map(entry => entry.name));
            const refused = admin.selected.filter(name => !included.has(name)).map(name => {
                const report = reports.find(entry => entry.name === name);
                return { name, reason: report?.reason ?? 'Dossier absent' };
            });
            need(!refused.length, 'Sélection administrateur non appliquée : ' + JSON.stringify(refused));
        }
        index = json(indexFile);
        const removedModels = [];
        for (const model of managed) if (!Object.hasOwn(index.models, model) && !manualRetired.has(model)) {
            const old = initialIndex.models[model] ?? initialIndex.retired[model];
            if (old) { index.retired[model] = old; removedModels.push(model); }
        }
        replace(indexFile, encoded(index));
        const finalCfg = { version: 1, scopes, packs: Object.fromEntries([...packSpecs].map(([id, p]) =>
            [id, { resource: p.resource, version: p.version, sha256: p.sha256 }])) };
        configAt(runtime, finalCfg);
        fs.mkdirSync(path.join(staging, 'resources/[celk-packs]'), { recursive: true });
        for (const [id, spec] of packSpecs) canonicalResource(packSources.get(id), path.join(staging, 'resources/[celk-packs]', spec.resource), spec);
        const finalReader = createActivation({ root: local, scopes, compileMount: compiler(registry), runtimeVersion,
            configuredPacks: new Map(Object.entries(finalCfg.packs)) });
        let loaded = finalReader.loadReady();
        need(loaded.refused.size === 0, 'Prévol final des archives refusé : ' + JSON.stringify([...loaded.refused]));
        const reusedSelections = [];
        for (const [model, release] of loaded.ready) {
            if (!accepted.some(entry => entry.model === model) || manualRetired.has(model)) continue;
            const priorActive = initialIndex.models[model];
            const old = priorActive ?? (automaticRetired.has(model) ? initialIndex.retired[model] : undefined);
            if (!old || old.publisher !== release.publisher || old.sha256 === release.sha256) continue;
            const previousDoc = json(path.join(local, 'accepted', old.sha256, 'model-export.json'));
            const proposedDoc = json(path.join(local, 'accepted', release.sha256, 'model-export.json'));
            // Do not try to compile an obsolete pack version for a genuinely new composition.
            if (declaredComposition(previousDoc) !== declaredComposition(proposedDoc)) continue;
            const pin = { revision: old.revision, sha256: old.sha256 };
            const verified = finalReader.loadVersion(model, pin);
            need(verified && compiledComposition(verified) === compiledComposition(release),
                'Composition scellée précédente différente après validation native : ' + model);
            const restored = finalReader.activate({ model, pins: { [model]: pin } });
            need(restored.ok && restored.models.get(model)?.sha256 === old.sha256,
                'Réactivation native de la composition identique refusée : ' + model);
            const reused = { model, publisher: old.publisher, previousState: priorActive ? 'active' : 'automatic-retired',
                revision: old.revision, sha256: old.sha256 };
            reusedSelections.push(reused);
            for (const report of reports) if (report.model === model && report.status !== 'refused') {
                Object.assign(report, { status: priorActive ? 'unchanged' : 'restored', added: 0,
                    kept: release.variants.size, reusedSelection: reused });
            }
        }
        if (reusedSelections.length) {
            // Native imports used a private working index. Do not publish their unused
            // revisions or advance the historical counter for an unchanged composition.
            index = json(indexFile);
            const reusedModels = new Map(reusedSelections.map(record => [record.model, record.publisher]));
            const referenced = new Set([...Object.values(index.models), ...Object.values(index.retired)].map(record => record.sha256));
            for (const [digest, record] of Object.entries(index.history)) {
                if (reusedModels.get(record.model) !== record.publisher || Object.hasOwn(initialIndex.history, digest) || referenced.has(digest)) continue;
                const source = path.join(local, 'accepted', digest);
                const archive = path.join(staging, 'preflight-revisions');
                fs.mkdirSync(archive, { recursive: true });
                normal(source);
                need(/^[a-f0-9]{64}$/.test(digest) && inside(staging, source), 'Archive transitoire hors génération');
                fs.renameSync(source, path.join(archive, digest));
                delete index.history[digest];
            }
            replace(indexFile, encoded(index));
            finalReader.indexed();
            loaded = finalReader.loadReady();
            need(loaded.refused.size === 0, 'Relecture native après réutilisation refusée : ' + JSON.stringify([...loaded.refused]));
        }
        // Raw import working copies are not needed by loadReady. Keep them for evidence
        // outside resources too, including any undeclared nested manifests/scripts.
        if (importedNames.size) {
            const archive = path.join(staging, 'preflight-sets');
            fs.mkdirSync(archive);
            for (const setName of importedNames) {
                const from = path.join(local, 'install-sets', setName), to = path.join(archive, setName);
                if (exists(from)) { normal(from); need(inside(staging, from) && inside(staging, to), 'Archive temporaire hors génération'); fs.renameSync(from, to); }
            }
        }
        const resourcesRecords = resourceRecords(staging);
        const receipt = { schema: 'tryagain.folder-generation', version: 1, signature, runtimeVersion,
            provenance: 'Local administrator admission; publisher string is not a cryptographic identity.',
            proof: 'Offline filesystem and compiler only; no FXServer/GTA execution.',
            codeDigest, preparerDigest, resourcesDigest: hash(Buffer.from(JSON.stringify(resourcesRecords))), configDigest: hash(encoded(finalCfg)),
            accepted, reports, reusedSelections, managedModels: [...managed].sort(), removedModels, activeModels: [...loaded.ready.keys()],
            activeSelections: Object.fromEntries([...loaded.ready].map(([model, release]) => [model, release.sha256])),
            ...(admin ? { adminSelection: admin.selected } : {}), ...(withAdmin ? { adminDigest } : {}),
            ...(profile ? { startupResources: profile.entries } : {}) };
        writeNew(path.join(staging, 'receipt.json'), encoded(receipt));
        writeNew(path.join(staging, 'start-order.cfg'), Buffer.from(startOrder(profile?.entries, withAdmin)));
        const name = 'g-' + randomUUID(), final = path.join(generations, name);
        fs.renameSync(staging, final); staging = null;
        verifyGeneration({ folder: final, receipt });
        // Fault injection is only a caller-supplied test callback, never loaded from pack data.
        if (beforeCommit) beforeCommit();
        checkAdminUnchanged();
        checkProfileUnchanged(home, profile);
        replace(path.join(home, 'CURRENT'), Buffer.from(name + '\n'));
        return { changed: true, generation: name, folder: final, activeModels: receipt.activeModels, accepted, reports, reusedSelections };
    } finally {
        fs.closeSync(fd); fs.unlinkSync(lock);
        // Pending generations remain forensic artifacts. No recursive deletion of user backups.
    }
}

if (require.main === module) {
    try { console.log(JSON.stringify(prepare({ home: process.argv[2] }), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { prepare, currentAt, verifyGeneration, joaat, tree, normal, read, replace, id, readAdminSelection,
    policyAt, ROOT, startOrder };
