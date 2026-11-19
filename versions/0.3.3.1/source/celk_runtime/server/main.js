'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const name = GetCurrentResourceName();
const base = GetResourcePath(name);
const { createActivation } = require(path.join(base, 'server/activation.js'));
const { readConfig, preparePacks } = require(path.join(base, 'server/runtime-config.js'));
const { createMountStore, migrateLegacyRecord } = require(path.join(base, 'server/mount-store.js'));
const { createInstalledMounts } = require(path.join(base, 'server/installed-mounts.js'));
const sadler = require(path.join(base, 'server/sadler-state.js'));
const fitAce = 'celk.fit';
const driveAce = 'celk.drive';
const bindAce = 'celk.bind';
const log = line => console.log(`[CELK] ${line}`);
const tell = (player, message) => emitNet('celk:message', player, message);
const allowed = (player, ace) => player > 0 && IsPlayerAceAllowed(String(player), ace);

function boot() {
    const framework = 'celk_qbox_adapter';
    const garage = 'qbx_garages';
    const configured = GetConvar('celk_framework_adapter', 'auto');
    if (configured && !['auto', framework].includes(configured)) throw Error('Adaptateur CELK non reconnu');
    let useGarage = configured === framework;
    function garageMode() {
        // Latch the stricter path once either part of a Qbox integration is present.
        useGarage ||= [garage, framework].some(resource => GetResourceState(resource) !== 'missing');
        return useGarage;
    }
    function garageReady() {
        return [garage, framework].every(resource => GetResourceState(resource) === 'started');
    }
    function permitted(player, ace, target, durable, service) {
        if (!garageMode()) return allowed(player, ace);
        if (player <= 0 || !target || !garageReady()) return false;
        const action = ace === fitAce ? 'fit' : ace === driveAce ? 'drive' : 'bind';
        const vehicle = { entity: target.entity, netId: target.netId, model: target.model };
        try { return global.exports[framework].Authorize(player, action, service ?? '', vehicle, durable) === true; }
        catch { return false; }
    }
    function permittedBinding(player, ace, binding) {
        return permitted(player, ace, binding, binding.vehicleId, binding.saved?.variant.service);
    }

    const environment = { name, hash: GetHashKey, state: GetResourceState, path: GetResourcePath,
        version: resource => GetResourceMetadata(resource, 'version', 0) };
    const settings = readConfig(base, environment);
    const { scopes, models: modelNames } = settings;
    const root = path.join(base, 'local');
    function openActivation() {
        const { errors, compileMount } = preparePacks(settings, environment);
        for (const [id, reason] of errors) log(`Pack ${id} · ${reason}`);
        return createActivation({ root, scopes, compileMount, runtimeVersion: environment.version(name),
            configuredPacks: new Map(settings.packs) });
    }
    const activation = openActivation();
    const { ready: active, refused } = activation.loadReady();
    for (const [model, reason] of refused) log(`Modèle ${model} suspendu · ${reason}`);
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

    global.exports('ReadActiveSelections', () => GetInvokingResource() === 'celk_admin' && running
        ? JSON.stringify(Object.fromEntries([...active].map(([model, release]) => [model, release.sha256]))) : null);

    global.exports('RestoreGarageMount', (id, entity, netId) => {
        if (!running || GetInvokingResource() !== framework || !garageReady()) return false;
        if (!Number.isInteger(id) || id < 1 || id > 2147483647 || !Number.isInteger(entity) || entity < 1 ||
            !Number.isInteger(netId) || netId < 1 || netId > 65535) return false;
        if (!DoesEntityExist(entity) || GetEntityType(entity) !== 2 ||
            NetworkGetNetworkIdFromEntity(entity) !== netId || NetworkGetEntityFromNetworkId(netId) !== entity ||
            Entity(entity).state.vehicleid !== id) return false;
        const modelHash = GetEntityModel(entity) >>> 0;
        const model = modelNames.get(modelHash);
        if (!active.has(model)) return false;
        const vehicleId = `qbx-${id}`;
        const existing = mounts.get(entity);
        if (existing && isCurrent(existing)) return existing.vehicleId === vehicleId;
        try {
            const binding = mounts.bind({ model, modelHash, entity, netId, bucket: GetEntityRoutingBucket(entity) }, vehicleId);
            mark(binding);
            publish();
            if (binding.saved && GetConvar('celk_qbox_fictif', '') === 'on') {
                log(`Garage · ${model} · montage restauré à la sortie · ${binding.saved.parts.length} pièces · effets arrêtés`);
            }
            return true;
        } catch (error) {
            log(`Garage · ${model} · ${error.message}`);
            return false;
        }
    });

    function menu(player, pane, requestId, notice) {
        function reject(message) {
            if (requestId !== undefined) return emitNet('celk:options', player, { pane, requestId, error: message });
            tell(player, message);
        }
        const binding = boundDriver(player);
        if (!binding) return reject('Le conducteur doit faire lier ce véhicule par un opérateur autorisé.');
        const fitting = pane === 'variants';
        if (!permittedBinding(player, fitting ? fitAce : driveAce, binding)) return reject('Permission CELK requise.');
        const delivery = active.get(binding.model);
        if (!delivery || (!fitting && !binding.saved)) return reject('Aucun montage actif disponible.');
        const rampControls = !fitting && binding.sadler ? sadler.options(binding.sadler) : undefined;
        const rampPose = rampControls ? sadler.snapshot(binding.sadler, performance.now()) : undefined;
        const choices = fitting ? [...delivery.variants.values()].map(({ id, label, service }) => ({ id, label, service })) :
            rampControls ? [] : [{ id: '', label: 'Séquence d’origine' }, ...binding.saved.variant.library.choices.map(({ id, name }) => ({ id, label: name }))];
        const projectors = fitting ? [] : binding.saved.parts.filter(part => part.projector).map(({ id, name: label, projector }) => ({
            id, label, ...binding.projectors.get(id), selected: binding.selectedProjector === id,
            aimable: projector.yawMin < projector.yawMax || projector.pitchMin < projector.pitchMax,
        }));
        emitNet('celk:options', player, { pane, requestId, stamp: binding.stamp, choices, model: binding.model, notice,
            mountLabel: binding.saved?.variant.label, service: binding.saved?.variant.service,
            selected: fitting ? binding.saved?.variant.id : binding.scene,
            ...(rampPose ? { rampControls, rampMotion: { target: rampPose.target, remainingMs: rampPose.remainingMs } } : {}),
            ...(projectors.length ? { projectors } : {}) });
    }

    const validMenuRequest = id => Number.isInteger(id) && id > 0 && id <= 0x7fffffff;

    function stopped(binding) {
        return GetEntitySpeed(binding.entity) <= .1;
    }

    RegisterCommand('celk_bind', (source, args) => {
        const player = Number(source);
        const current = driver(player);
        if (!permitted(player, bindAce, current, args[0]) || (garageMode() && args.length !== 1)) return;
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
        if (args.length) return;
        const binding = boundDriver(player);
        if (!binding || !stopped(binding) || !permittedBinding(player, bindAce, binding)) return;
        mounts.unbind(binding.entity);
        Entity(binding.entity).state.set('celkMountStamp', null, true);
        publish();
        tell(player, 'Entité libérée. Le montage enregistré est conservé.');
    }, false);

    onNet('celk:request', (pane, requestId) => {
        const player = Number(global.source);
        if (player <= 0 || !GetPlayerName(String(player)) || throttled(player, pane === 'state' ? 'state' : 'menu', 350)) return;
        if (pane === 'state') publish(player);
        if ((pane === 'variants' || pane === 'scenes') && (requestId === undefined || validMenuRequest(requestId))) {
            menu(player, pane, requestId);
        }
    });

    onNet('celk:operate', (stamp, op, value, epoch, requestId) => {
        const player = Number(global.source);
        if (typeof stamp !== 'string' || stamp.length !== 36 || typeof value !== 'string' || value.length > 100) return;
        const refresh = op === 'sadler' && validMenuRequest(requestId);
        if (throttled(player, op === 'siren' || op === 'lvcSiren' ? 'siren' : 'operate', 180)) {
            if (refresh && !throttled(player, 'menu-feedback', 350)) {
                menu(player, 'scenes', requestId, 'Commande trop rapprochée. Réessaie dans un instant.');
            }
            return;
        }
        const binding = boundDriver(player, stamp);
        if (!binding || !permittedBinding(player, op === 'variant' ? fitAce : driveAce, binding)) {
            if (refresh) menu(player, 'scenes', requestId);
            return;
        }
        if (op === 'siren' || op === 'lvcSiren') {
            const lvc = op === 'lvcSiren';
            if (lvc && (GetResourceState('lvc') !== 'started' || GetConvar('celk_lvc_enabled', '1') !== '1')) return;
            if (value !== '' || !mounts.effects(binding, 'siren', lvc ? 'lvc' : 'celk', epoch, player)) return;
            if (GetConvar('celk_qbox_fictif', '') === 'on') {
                log(`Sirène · ${lvc ? 'LVC' : 'CELK autonome'} · ${binding.model} · ${binding.siren ? 'allumée' : 'éteinte'}`);
            }
            publish();
            return;
        }
        if (['lights', 'lvcToggle', 'lightsState'].includes(op)) {
            const fromLvc = op !== 'lights';
            if (fromLvc && (GetResourceState('lvc') !== 'started' || GetConvar('celk_lvc_enabled', '1') !== '1')) return;
            if (op === 'lightsState') {
                if (!['0', '1'].includes(value) || binding.lights === (value === '1')) return;
            } else if (value !== '') return;
            if (mounts.effects(binding, 'lights', '', epoch, player)) {
                if (GetConvar('celk_qbox_fictif', '') === 'on') {
                    log(`Éclats · ${fromLvc ? 'LVC' : 'CELK autonome'} · ${binding.model} · ${binding.lights ? 'allumés' : 'éteints'}`);
                }
                publish();
            }
            return;
        }
        if (op !== 'variant') {
            const changed = mounts.effects(binding, op, value, epoch, player);
            if (changed) publish();
            if (refresh) menu(player, 'scenes', requestId, changed ? undefined : 'Cette commande est indisponible dans cet état.');
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
        if (![0, 1, 3].includes(args.length)) return log('Usage : celk_preflight|celk_activate [modèle [révision empreinte]]');
        if ((args.length && !Object.hasOwn(scopes, args[0])) || (args.length === 3 && !/^[1-9]\d*$/.test(args[1]))) {
            return log('Modèle ou révision invalide.');
        }
        const pins = args.length === 3 ? { [args[0]]: { revision: Number(args[1]), sha256: args[2] } } : undefined;
        try {
            const reader = openActivation();
            const options = { pins, model: args[0] };
            const result = commit ? reader.activate(options) : reader.preview(options);
            for (const [model, report] of result.reports) {
                log(`${model} · ${report.message ?? 'résolu'}`);
                for (const candidate of report.reports) {
                    log(`${candidate.file} · ${candidate.revision ?? '?'} · ${candidate.status}${candidate.reason ? ` · ${candidate.reason}` : ''}`);
                }
            }
            if (result.ok && commit) log(result.changed ? 'Index écrit. Redémarre uniquement la ressource CELK au prochain créneau.'
                : 'Activation idempotente. Index inchangé.');
            else if (result.ok) log('Précontrôle réussi.');
            else log('Activation refusée. L’index actif reste en place.');
        } catch (error) { log(`Préparation interrompue : ${error.message}`); }
    }

    RegisterCommand('celk_preflight', (source, args) => inspectCommand(source, args, false), true);
    RegisterCommand('celk_activate', (source, args) => inspectCommand(source, args, true), true);
    function installSetCommand(source, args, commit) {
        if (Number(source) !== 0) return;
        if (args.length !== (commit ? 2 : 1) || (commit && !/^[0-9a-f]{64}$/.test(args[1]))) {
            return log(commit ? 'Usage : celk_install_set <dossier> <empreinte du plan>'
                : 'Usage : celk_preflight_set <dossier>');
        }
        try {
            const reader = openActivation();
            const plan = commit ? reader.installSet(args[0], args[1]) : reader.previewInstallSet(args[0]);
            const { model, revision } = plan.record;
            log(`Ensemble ${args[0]} · ${model} r${revision} · ${plan.kept} variantes conservées · ${plan.added} à ajouter`);
            if (!commit) log(`Empreinte du plan : ${plan.token}`);
            else log(plan.added ? 'Ensemble installé. Redémarre uniquement la ressource CELK au prochain créneau.'
                : 'Ensemble déjà installé. Index inchangé.');
        } catch (error) { log(`Ensemble refusé : ${error.message}`); }
    }
    RegisterCommand('celk_preflight_set', (source, args) => installSetCommand(source, args, false), true);
    RegisterCommand('celk_install_set', (source, args) => installSetCommand(source, args, true), true);
    RegisterCommand('celk_retire', (source, args) => {
        if (Number(source) !== 0) return;
        if (args.length !== 2 || args[1] !== 'confirm') return log('Usage : celk_retire <modèle> confirm');
        try {
            const changed = activation.retire(args[0]);
            if (changed) log(`Modèle ${args[0]} retiré de l’index. Sauvegardes et livraisons conservées. Appliquer au prochain redémarrage CELK.`);
            else log(`Modèle ${args[0]} déjà retiré.`);
        } catch (error) { log(`Retrait refusé : ${error.message}`); }
    }, true);
    RegisterCommand('celk_status', source => {
        if (Number(source) !== 0) return;
        const garageStatus = garageMode() ? (garageReady() ? 'Qbox' : 'Qbox indisponible') : 'autonome';
        log('Mode garage : ' + garageStatus);
        for (const [model, release] of active) log(`${model} · ${release.publisher} · révision ${release.revision} · ${release.sha256} · ${release.variants.size} variantes chargées`);
        for (const [model, reason] of refused) log(`Modèle ${model} suspendu · ${reason}`);
        try {
            const index = activation.indexed();
            for (const [model, record] of index.retired) log(`${model} retiré · dernière révision ${record.revision} · ${record.sha256}`);
            for (const [model, record] of index.active) {
                if (active.get(model)?.sha256 !== record.sha256) log(`${model} · révision enregistrée ${record.revision} · ${record.sha256}`);
            }
        } catch (error) { log(`Index illisible : ${error.message}`); }
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
                continue;
            }
            if (binding.lights && (!permittedBinding(binding.operator, driveAce, binding) || driver(binding.operator)?.entity !== binding.entity)) {
                Object.assign(binding, { lights: false, siren: undefined, epoch: undefined, operator: undefined });
                changed = true;
            }
            const operator = binding.projectorOperator;
            if (operator && (!permittedBinding(operator, driveAce, binding) || driver(operator)?.entity !== binding.entity)) {
                changed = mounts.stopProjectors(binding) || changed;
            }
            const rampOperator = binding.sadler?.operator;
            if (rampOperator && (!permittedBinding(rampOperator, driveAce, binding) || driver(rampOperator)?.entity !== binding.entity)) {
                changed = sadler.stop(binding.sadler) || changed;
            }
        }
        if (changed) publish();
    }, 1000);
    on('onResourceStop', resource => {
        if (resource === name) running = false;
        else if (!settings.resources.has(resource.toLowerCase())) return;
        const affected = new Set();
        if (running) for (const [model, release] of active) {
            if (![...release.variants.values()].some(variant => variant.resources.some(required =>
                required.toLowerCase() === resource.toLowerCase()))) continue;
            affected.add(model);
            active.delete(model);
            refused.set(model, `pack arrêté : ${resource}. Démarrer ce pack avant CELK.`);
            log(`Modèle ${model} suspendu · ${refused.get(model)}`);
        }
        for (const binding of mounts.entries()) {
            if (running && !affected.has(binding.model)) continue;
            if (isCurrent(binding)) Entity(binding.entity).state.set('celkMountStamp', null, true);
            mounts.unbind(binding.entity);
        }
        publish();
    });
    log(`Script ${GetResourceMetadata(name, 'version', 0)} · ${active.size} export(s) actif(s).`);
}

try { boot(); }
catch (error) { log(`Démarrage refusé : ${error.message}`); }
