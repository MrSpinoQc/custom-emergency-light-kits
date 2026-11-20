'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadPack, compiler } = require('./packs.js');

const plain = value => value && Object.getPrototypeOf(value) === Object.prototype;
const id = (value, pattern) => typeof value === 'string' && pattern.test(value) && !value.endsWith('.') &&
    !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:[.]|$)/i.test(value);
const name = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const resourceName = /^[a-zA-Z0-9_-]{1,64}$/;
const vehicleName = /^[a-z0-9][a-z0-9_]{0,63}$/;
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const hex = /^[a-f0-9]{64}$/;

function need(condition, message) {
    if (!condition) throw new Error(message);
}

function readConfig(base, environment) {
    const location = path.join(base, 'local');
    const file = path.join(location, 'celk.config.json');
    need(fs.lstatSync(location).isDirectory(), 'Répertoire local normal requis');
    const info = fs.lstatSync(file);
    need(info.isFile() && info.size > 0 && info.size <= 32768, 'Configuration locale invalide');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    need(plain(cfg) && cfg.version === 1 && Object.keys(cfg).length === 3 && plain(cfg.scopes) && plain(cfg.packs),
        'Configuration v1 attendue : scopes et packs autorisés');
    const models = new Map(), resources = new Set();
    const scopes = Object.entries(cfg.scopes), packs = Object.entries(cfg.packs);
    need(scopes.length <= 128 && packs.length <= 32, 'Configuration trop volumineuse');
    for (const [model, origin] of scopes) {
        need(id(model, vehicleName) && id(origin, name), 'Modèle GTA ou provenance invalide : ' + model);
        const hash = environment.hash(model) >>> 0;
        need(hash && !models.has(hash), 'Deux modèles ont la même empreinte GTA : ' + model);
        models.set(hash, model);
    }
    for (const [pack, spec] of packs) {
        need(id(pack, name) && pack !== 'phantom-fantome' && plain(spec) && Object.keys(spec).length === 3 &&
            id(spec.resource, resourceName) && spec.resource.toLowerCase() !== environment.name.toLowerCase() &&
            !resources.has(spec.resource.toLowerCase()) && typeof spec.version === 'string' && spec.version.length <= 64 &&
            semver.test(spec.version) && typeof spec.sha256 === 'string' && hex.test(spec.sha256),
        'Identité, ressource, version ou empreinte du pack invalide : ' + pack);
        resources.add(spec.resource.toLowerCase());
    }
    return { scopes: cfg.scopes, packs, models, resources };
}

function preparePacks(settings, environment) {
    const registry = new Map(), errors = new Map(), claims = new Map(), invalid = new Map();
    function started(pack) {
        need(environment.state(pack.resource) === 'started',
            `Ressource absente ou arrêtée : démarrer ${pack.resource} avant ${environment.name}`);
        need(environment.version(pack.resource) === pack.version, 'Version FiveM du pack différente : ' + pack.resource);
    }
    for (const [id, spec] of settings.packs) {
        try {
            started(spec);
            const verified = loadPack(environment.path(spec.resource), spec, id);
            for (const [kind, names] of [['YDR', verified.assets], ['YTYP', verified.types]]) {
                for (const value of names) {
                    const key = kind + ':' + (environment.hash(value) >>> 0);
                    const claim = claims.get(key);
                    if (claim) {
                        const diagnostic = `Collision ${kind} GTA entre ${claim.id} (${claim.value}) et ${id} (${value})`;
                        if (!invalid.has(id)) invalid.set(id, diagnostic);
                        if (!invalid.has(claim.id)) invalid.set(claim.id, diagnostic);
                    } else claims.set(key, { id, value });
                }
            }
            registry.set(id, verified);
        } catch (error) { errors.set(id, error.message); }
    }
    for (const [id, diagnostic] of invalid) {
        registry.delete(id);
        errors.set(id, diagnostic);
    }
    return { errors, compileMount: compiler(registry, errors, started) };
}

module.exports = { readConfig, preparePacks };
