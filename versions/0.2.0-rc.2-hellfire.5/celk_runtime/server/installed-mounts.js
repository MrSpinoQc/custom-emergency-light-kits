'use strict';

const { isDeepStrictEqual } = require('node:util');
const { forMounted } = require('./light-timeline.js');
const { maxAccessoriesPerVehicle } = require('../installation-limits.json');

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const epochValid = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const arrows = new Map([['left', [4, 0]], ['right', [-4, 0]], ['up', [0, 3]], ['down', [0, -3]]]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function stops(parts = []) {
    return new Map(parts.filter(part => part.projector).map(part => [part.id, {
        on: false, yaw: part.projector.yaw, pitch: part.projector.pitch,
    }]));
}

function mountedParts(variant, ids) {
    if (ids.length > maxAccessoriesPerVehicle || new Set(ids).size !== ids.length) throw new Error('Nombre de pièces actives invalide');
    const selected = new Set(ids);
    const parts = variant.renderedParts.filter(part => selected.has(part.id));
    if (parts.length !== ids.length) throw new Error('Pièce enregistrée absente de la variante');
    const slots = new Set();
    for (const [i, part] of parts.entries()) {
        if (slots.has(part.slot)) throw new Error('Deux pièces occupent la même position de montage');
        slots.add(part.slot);
        const a = part.chassisPosition ?? part.position;
        for (const previous of parts.slice(0, i)) {
            const b = previous.chassisPosition ?? previous.position;
            if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .06) throw new Error('Deux positions de montage sont en conflit');
        }
    }
    return parts;
}

function readSaved(record, delivery, archived) {
    if (!record) return null;
    const variant = delivery?.variants.get(record.variantId);
    if (!variant || delivery.publisher !== record.publisher || delivery.model !== record.model || variant.service !== record.service) {
        throw new Error('Variante sauvegardée retirée ou incompatible. Restaure une livraison acceptée ou choisis une variante explicitement.');
    }
    if (delivery.sha256 !== record.exportSha256) {
        const origin = archived(record.model, { revision: record.revision, sha256: record.exportSha256 });
        const old = origin?.variants.get(record.variantId);
        if (!old || old.service !== variant.service || old.mountSha256 !== variant.mountSha256 ||
            !isDeepStrictEqual(old.parts, variant.parts) || !isDeepStrictEqual(old.renderedParts, variant.renderedParts)) {
            throw new Error('Le montage sauvegardé diffère de la variante active. Une migration explicite est requise.');
        }
    }
    return { variant, parts: mountedParts(variant, record.partIds) };
}

function createInstalledMounts({ store, active, archived, stamp }) {
    const bindings = new Map();
    const byVehicleId = new Map();

    function bind(target, vehicleId, reassign = false) {
        if (typeof vehicleId !== 'string' || !idPattern.test(vehicleId)) throw new Error('Identifiant durable invalide');
        if (byVehicleId.has(vehicleId) && byVehicleId.get(vehicleId) !== target.entity) throw new Error('Identifiant déjà lié à un autre véhicule');
        if (bindings.has(target.entity) && bindings.get(target.entity).vehicleId !== vehicleId) throw new Error('Ce véhicule a déjà une identité durable');
        const record = store.get(vehicleId);
        if (record && record.model !== target.model) throw new Error('Cet identifiant correspond à un autre modèle');
        const saved = reassign ? null : readSaved(record, active().get(target.model), archived);
        const binding = { ...target, vehicleId, stamp: stamp(), saved, lights: false, scene: saved?.variant.library.defaultId ?? '',
            projectors: stops(saved?.parts), selectedProjector: undefined };
        bindings.set(target.entity, binding);
        byVehicleId.set(vehicleId, target.entity);
        return binding;
    }

    function unbind(entity) {
        const binding = bindings.get(entity);
        if (!binding) return false;
        byVehicleId.delete(binding.vehicleId);
        bindings.delete(entity);
        return true;
    }

    function choose(binding, variantId) {
        const delivery = active().get(binding.model);
        const variant = delivery?.variants.get(variantId);
        if (!variant) throw new Error('Variante indisponible pour ce véhicule');
        if (binding.saved?.variant.id === variant.id && binding.saved.variant.service === variant.service) return false;
        const partIds = variant.parts.map(part => part.id);
        const parts = mountedParts(variant, partIds);
        const nextStamp = stamp();
        store.set(binding.vehicleId, { model: delivery.model, publisher: delivery.publisher, revision: delivery.revision,
            exportSha256: delivery.sha256, service: variant.service, variantId: variant.id, partIds });
        Object.assign(binding, { stamp: nextStamp, saved: { variant, parts }, scene: variant.library.defaultId ?? '',
            lights: false, epoch: undefined, operator: undefined, projectors: stops(parts), selectedProjector: undefined,
            projectorOperator: undefined });
        return true;
    }

    function projectorEffect(binding, op, argument, source) {
        if (op === 'projector') {
            const state = binding.projectors.get(argument);
            if (!state) return false;
            binding.selectedProjector = argument;
            state.on = !state.on;
        } else {
            const id = binding.selectedProjector;
            const angles = arrows.get(argument);
            const state = binding.projectors.get(id);
            const bounds = binding.saved?.parts.find(part => part.id === id)?.projector;
            if (!angles || !state || !bounds) return false;
            const yaw = clamp(state.yaw + angles[0], bounds.yawMin, bounds.yawMax);
            const pitch = clamp(state.pitch + angles[1], bounds.pitchMin, bounds.pitchMax);
            if (yaw === state.yaw && pitch === state.pitch) return false;
            Object.assign(state, { yaw, pitch });
        }
        binding.projectorOperator = source;
        return true;
    }

    function stopProjectors(binding) {
        const changed = [...binding.projectors.values()].some(state => state.on);
        for (const state of binding.projectors.values()) state.on = false;
        binding.selectedProjector = undefined;
        binding.projectorOperator = undefined;
        return changed;
    }

    function effects(binding, op, argument, epoch, source) {
        if (!binding.saved?.parts.length || !epochValid(epoch)) return false;
        if (op === 'projector' || op === 'aim') return projectorEffect(binding, op, argument, source);
        if (op === 'lights') {
            if (argument !== '') return false;
            binding.lights = !binding.lights;
        } else if (op === 'scene' && typeof argument === 'string' &&
            (argument === '' || binding.saved.variant.library.byId.has(argument))) {
            if (binding.scene === argument) return false;
            binding.scene = argument;
        } else return false;
        binding.epoch = binding.lights ? epoch : undefined;
        binding.operator = binding.lights ? source : undefined;
        return true;
    }

    function snapshot(binding) {
        const { netId, stamp, modelHash, saved, lights, epoch, scene } = binding;
        if (!saved?.parts.length) return null;
        const { library } = saved.variant;
        const selected = library.byId.get(scene);
        const timeline = selected ? (forMounted(selected, saved.parts) ?? { ...selected, tracks: [] })
            : forMounted(library.original, saved.parts);
        const parts = binding.projectors.size ? saved.parts.map(part => part.projector ? {
            ...part, projector: { ...part.projector, ...binding.projectors.get(part.id) },
        } : part) : saved.parts;
        return { netId, stamp, modelHash, lights, ...(lights ? { epoch } : {}), ...(timeline ? { timeline } : {}), parts };
    }

    return { bind, unbind, choose, effects, stopProjectors, snapshot, get: entity => bindings.get(entity), entries: () => [...bindings.values()] };
}

module.exports = { createInstalledMounts, readSaved, mountedParts };
