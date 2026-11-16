'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const name = GetCurrentResourceName();
const base = GetResourcePath(name);
const { createActivation } = require(path.join(base, 'server/activation.js'));
const { loadPack, compiler, rendererId } = require(path.join(base, 'server/packs.js'));
const { createMountStore, migrateLegacyRecord } = require(path.join(base, 'server/mount-store.js'));
const { createInstalledMounts } = require(path.join(base, 'server/installed-mounts.js'));
const fitAce = 'celk.fit';
const driveAce = 'celk.drive';
const bindAce = 'celk.bind';
const modelNames = new Map([[GetHashKey('phantom') >>> 0, 'phantom']]);
const log = line => console.log(`[CELK] ${line}`);
const tell = (player, message) => emitNet('celk:message', player, message);
const allowed = (player, ace) => player > 0 && IsPlayerAceAllowed(String(player), ace);

function runtimeConfig() {
    const file = path.join(base, 'local', 'celk.config.json');
    const info = fs.lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 32768) throw new Error('Configuration locale invalide');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const pack = cfg?.packs?.[rendererId];
    if (cfg?.version !== 1 || typeof cfg.scopes?.phantom !== 'string' || Object.keys(cfg.scopes).length !== 1 ||
        Object.keys(cfg.packs).length !== 1 || !/^[a-zA-Z0-9_-]{1,64}$/.test(pack?.resource ?? '') || pack.resource === name) {
        throw new Error('Configuration v1 attendue avec provenance Phantom et pack de pièces');
    }
    if (GetResourceState(pack.resource) !== 'started') throw new Error(`Démarrer le pack ${pack.resource} avant ${name}`);
    if (GetResourceMetadata(pack.resource, 'version', 0) !== pack.version) throw new Error('Version FiveM du pack différente');
    const packPath = GetResourcePath(pack.resource);
    return { scopes: cfg.scopes, packResource: pack.resource, compileMount: compiler(new Map([[rendererId, loadPack(packPath, pack)]])) };
}

function boot() {
    const { scopes, packResource, compileMount } = runtimeConfig();
    const root = path.join(base, 'local');
    const activation = createActivation({ root, scopes, compileMount });
    const active = activation.load();
    const store = createMountStore(path.join(root, 'installed-mounts.json'));
    const mounts = createInstalledMounts({ store, active: () => active, archived: activation.loadVersion, stamp: randomUUID });
    const lastRequest = new Map();
    let running = true;

    function driver(player) {
        if (!running || player <= 0 || !GetPlayerName(String(player))) return null;
        const ped = GetPlayerPed(String(player));
        if (!ped || !DoesEntityExist(ped)) return null;
        const entity = GetVehiclePedIsIn(ped, false);
        if (!entity || !DoesEntityExist(entity) || GetPedInVehicleSeat(entity, -1) !== ped) return null;
        const bucket = GetPlayerRoutingBucket(String(player));
        if (GetEntityRoutingBucket(entity) !== bucket) return null;
        const modelHash = GetEntityModel(entity) >>> 0;
        const model = modelNames.get(modelHash);
        const netId = NetworkGetNetworkIdFromEntity(entity);
        if (!model || !netId) return null;
        return { model, netId, modelHash, entity, bucket };
    }

    function isCurrent(binding) {
        return DoesEntityExist(binding.entity) && GetEntityModel(binding.entity) >>> 0 === binding.modelHash &&
            NetworkGetNetworkIdFromEntity(binding.entity) === binding.netId &&
            GetEntityRoutingBucket(binding.entity) === binding.bucket;
    }

    function boundDriver(player, stamp) {
        const current = driver(player);
        const binding = current && mounts.get(current.entity);
        return binding && isCurrent(binding) && (stamp === undefined || stamp === binding.stamp) ? binding : null;
    }

    function throttled(player, channel, wait) {
        const key = `${player}:${channel}`;
        const now = Date.now();
        if (now - (lastRequest.get(key) ?? 0) < wait) return true;
        lastRequest.set(key, now);
        return false;
    }

    function publish(only) {
        const buckets = new Map();
        if (running) for (const binding of mounts.entries()) {
            const entry = isCurrent(binding) && mounts.snapshot(binding);
            if (!entry) continue;
            const entries = buckets.get(binding.bucket) ?? [];
            entries.push(entry);
            buckets.set(binding.bucket, entries);
        }
        for (const candidate of only === undefined ? getPlayers() : [String(only)]) {
            const player = Number(candidate);
            if (!GetPlayerName(String(player))) continue;
            emitNet('celk:state', player, { version: 1, entries: buckets.get(GetPlayerRoutingBucket(String(player))) ?? [] });
        }
    }

    function mark(binding) {
        Entity(binding.entity).state.set('celkMountStamp', binding.stamp, true);
    }

    function menu(player, pane) {
        const binding = boundDriver(player);
        if (!binding) return tell(player, 'Le conducteur doit faire lier ce véhicule par un opérateur autorisé.');
        const fitting = pane === 'variants';
        if (!allowed(player, fitting ? fitAce : driveAce)) return tell(player, 'Permission CELK requise.');
        const delivery = active.get(binding.model);
        if (!delivery || (!fitting && !binding.saved)) return tell(player, 'Aucun montage actif disponible.');
        const choices = fitting ? [...delivery.variants.values()].map(({ id, label, service }) => ({ id, label, service })) :
            [{ id: '', label: 'Séquence d’origine' }, ...binding.saved.variant.library.choices.map(({ id, name }) => ({ id, label: name }))];
        emitNet('celk:options', player, { pane, stamp: binding.stamp, choices,
            selected: fitting ? binding.saved?.variant.id : binding.scene });
    }

    function stopped(binding) {
        return GetEntitySpeed(binding.entity) <= .1;
    }

    RegisterCommand('celk_bind', (source, args) => {
        const player = Number(source);
        if (!allowed(player, bindAce)) return;
        const current = driver(player);
        if (!current || !active.has(current.model) || !stopped(current) ||
            (args.length !== 1 && !(args.length === 2 && args[1] === 'reassign'))) {
            return tell(player, 'À l’arrêt au volant d’un modèle actif : /celk_bind <identifiant durable> [reassign].');
        }
        try {
            const binding = mounts.bind(current, args[0], args[1] === 'reassign');
            mark(binding);
            publish();
            tell(player, binding.saved ? 'Montage enregistré restauré. Les éclats sont arrêtés.' : 'Véhicule lié. Ouvre F6 pour choisir le service et le montage.');
        } catch (error) { tell(player, error.message); }
    }, false);

    RegisterCommand('celk_unbind', (source, args) => {
        const player = Number(source);
        if (args.length || !allowed(player, bindAce)) return;
        const binding = boundDriver(player);
        if (!binding || !stopped(binding)) return;
        mounts.unbind(binding.entity);
        Entity(binding.entity).state.set('celkMountStamp', null, true);
        publish();
        tell(player, 'Entité libérée. Le montage enregistré est conservé.');
    }, false);

    onNet('celk:request', pane => {
        const player = Number(global.source);
        if (player <= 0 || !GetPlayerName(String(player)) || throttled(player, pane === 'state' ? 'state' : 'menu', 350)) return;
        if (pane === 'state') publish(player);
        if (pane === 'variants' || pane === 'scenes') menu(player, pane);
    });

    onNet('celk:operate', (stamp, op, value, epoch) => {
        const player = Number(global.source);
        if (typeof stamp !== 'string' || stamp.length !== 36 || typeof value !== 'string' || value.length > 100 ||
            !allowed(player, op === 'variant' ? fitAce : driveAce) || throttled(player, 'operate', 180)) return;
        const binding = boundDriver(player, stamp);
        if (!binding) return;
        if (op !== 'variant') {
            if (mounts.effects(binding, op, value, epoch, player)) publish();
            return;
        }
        if (!stopped(binding)) return tell(player, 'Immobilise le véhicule avant de changer de variante.');
        try {
            if (mounts.choose(binding, value)) {
                mark(binding);
                publish();
                tell(player, 'Variante installée. Les éclats sont arrêtés.');
            }
        } catch (error) { tell(player, error.message); }
    });

    function inspectCommand(source, args, commit) {
        if (Number(source) !== 0) return;
        if (args.length !== 0 && args.length !== 3) return log('Usage : celk_preflight|celk_activate [modèle révision empreinte]');
        if (args.length && (!Object.hasOwn(scopes, args[0]) || !/^[1-9]\d*$/.test(args[1]))) return log('Modèle ou révision invalide.');
        const pins = args.length ? { [args[0]]: { revision: Number(args[1]), sha256: args[2] } } : undefined;
        try {
            const result = commit ? activation.activate({ pins }) : activation.preview({ pins });
            for (const [model, report] of result.reports) {
                log(`${model} · ${report.ok ? 'résolu' : report.message}`);
                for (const candidate of report.reports) {
                    log(`${candidate.file} · ${candidate.revision ?? '?'} · ${candidate.status}${candidate.reason ? ` · ${candidate.reason}` : ''}`);
                }
            }
            if (result.ok && commit) log('Index écrit. Redémarre uniquement la ressource CELK au prochain créneau.');
            else if (result.ok) log('Précontrôle réussi.');
            else log('Activation refusée. L’index actif reste en place.');
        } catch (error) { log(`Préparation interrompue : ${error.message}`); }
    }

    RegisterCommand('celk_preflight', (source, args) => inspectCommand(source, args, false), true);
    RegisterCommand('celk_activate', (source, args) => inspectCommand(source, args, true), true);
    RegisterCommand('celk_status', source => {
        if (Number(source) !== 0) return;
        for (const [model, release] of active) log(`${model} · ${release.publisher} · révision ${release.revision} · ${release.sha256} · ${release.variants.size} variantes chargées`);
        if (!active.size) log('Aucun export activé. Exécute celk_preflight puis celk_activate.');
    }, true);
    RegisterCommand('celk_migrate', (source, args) => {
        if (Number(source) !== 0) return;
        const [vehicleId] = args;
        if (args.length !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(vehicleId)) {
            return log('Usage : celk_migrate <identifiant durable>.');
        }
        try {
            if (store.get(vehicleId) || mounts.entries().some(binding => binding.vehicleId === vehicleId)) {
                throw new Error('Identifiant déjà utilisé. Examiner les sauvegardes avant migration.');
            }
            const migration = path.join(root, 'migration');
            function read(filename, maximum) {
                const full = path.join(migration, filename);
                const info = fs.lstatSync(full);
                if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) throw new Error('Fichier de migration invalide');
                return JSON.parse(fs.readFileSync(full, 'utf8'));
            }
            const previous = read('legacy-v1.json', 256 * 1024);
            const mapping = read('mapping.json', 8192);
            if (previous?.version !== 1 || !Object.hasOwn(previous.vehicles ?? {}, vehicleId)) throw new Error('Entrée historique v1 absente');
            const record = previous.vehicles[vehicleId];
            const delivery = active.get(record.model);
            const converted = migrateLegacyRecord(record, { vehicleId, modelExport: delivery, mapping });
            store.set(vehicleId, converted);
            log('Montage importé dans le nouveau fichier. La copie historique reste disponible.');
        } catch (error) { log(`Migration refusée : ${error.message}`); }
    }, true);

    on('entityRemoved', entity => { if (mounts.unbind(entity)) publish(); });
    on('playerDropped', () => {
        const player = Number(global.source);
        for (const key of lastRequest.keys()) if (key.startsWith(`${player}:`)) lastRequest.delete(key);
    });
    setInterval(() => {
        if (!running) return;
        let changed = false;
        for (const binding of mounts.entries()) {
            if (!isCurrent(binding)) {
                mounts.unbind(binding.entity);
                changed = true;
            } else if (binding.lights && (!allowed(binding.operator, driveAce) || driver(binding.operator)?.entity !== binding.entity)) {
                Object.assign(binding, { lights: false, epoch: undefined, operator: undefined });
                changed = true;
            }
        }
        if (changed) publish();
    }, 1000);
    on('onResourceStop', resource => {
        if (resource !== name && resource !== packResource) return;
        running = false;
        for (const binding of mounts.entries()) {
            if (isCurrent(binding)) Entity(binding.entity).state.set('celkMountStamp', null, true);
            mounts.unbind(binding.entity);
        }
        publish();
        if (resource === packResource) log('Pack arrêté. Redémarre le pack puis la ressource CELK.');
    });
    log(`Script ${GetResourceMetadata(name, 'version', 0)} · ${active.size} export(s) actif(s).`);
}

try { boot(); }
catch (error) { log(`Démarrage refusé : ${error.message}`); }
