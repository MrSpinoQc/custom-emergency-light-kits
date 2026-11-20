'use strict';

const mechanics = require('./sadler-behavior.cjs');

const modes = [['ligne', 'Ligne'], ['gauche', 'Flèche gauche'], ['droite', 'Flèche droite'], ['double', 'Double flèche']];
const switches = [['armed', 'Motif du volet'], ['linkedCorners', 'Coins associés'],
    ['independentCorners', 'Coins seuls'], ['serviceLights', 'Feux blancs de service'], ['paused', 'Pause des motifs J']];
const switchesById = new Set(switches.map(([id]) => id));
const cornerChoices = new Map([['coins:off', 'Arrêt'], ['coins:linked', 'Liés'], ['coins:independent', 'Seuls']]);

function cornerChoice(control) {
    return control.independentCorners ? 'coins:independent' : control.linkedCorners ? 'coins:linked' : 'coins:off';
}

function planFor(parts) {
    return parts?.find(part => part.kind === 'sadler-ramp-v1')?.sadler;
}

function initial(parts) {
    const plan = planFor(parts);
    return plan && { plan, control: { ...mechanics.initial(plan), paused: false },
        panelStartedAt: undefined, independentStartedAt: undefined, operator: undefined };
}

function command(binding, name, now, source) {
    if (name === 'open' || name === 'close') {
        const next = mechanics.move(binding.plan, binding.control, Number(name === 'open'), now);
        if (next === binding.control) return false;
        binding.control = next;
        binding.panelStartedAt = undefined;
    } else if (name.startsWith('mode:')) {
        const mode = name.slice(5);
        if (!Object.hasOwn(binding.plan.modes, mode) || mode === binding.control.mode) return false;
        binding.control = mechanics.action(binding.plan, binding.control, 'mode', mode, now);
        if (binding.control.armed) binding.panelStartedAt = now;
    } else if (cornerChoices.has(name)) {
        const control = binding.control;
        let next = control;
        for (const [key, value] of [['linkedCorners', name === 'coins:linked'],
            ['independentCorners', name === 'coins:independent']]) {
            if (next[key] === value) continue;
            next = mechanics.action(binding.plan, next, key, value, now);
            if (next[key] !== value) return false;
        }
        if (next === control) return false;
        binding.control = next;
        if (next.independentCorners !== control.independentCorners) {
            binding.independentStartedAt = next.independentCorners ? now : undefined;
        }
    } else if (switchesById.has(name)) {
        const control = binding.control;
        if (name === 'paused') binding.control = { ...control, paused: !control.paused };
        else binding.control = mechanics.action(binding.plan, control, name, !control[name], now);
        if (binding.control === control) return false;
        if (name === 'armed') binding.panelStartedAt = binding.control.armed ? now : undefined;
        if (name === 'independentCorners') binding.independentStartedAt = binding.control.independentCorners ? now : undefined;
    } else return false;
    binding.operator = source;
    return true;
}

function stop(binding) {
    const control = binding.control;
    const changed = switches.some(([name]) => control[name]);
    binding.control = { ...control, armed: false, linkedCorners: false, independentCorners: false,
        serviceLights: false, paused: false };
    binding.panelStartedAt = undefined;
    binding.independentStartedAt = undefined;
    binding.operator = undefined;
    return changed;
}

function snapshot(binding, now) {
    const { motion, mode, armed, linkedCorners, independentCorners, serviceLights, paused } = binding.control;
    return { position: mechanics.position(motion, now), target: motion.to,
        remainingMs: Math.max(0, motion.startedAt + motion.duration - now), mode, armed, linkedCorners,
        independentCorners, serviceLights, paused, panelElapsedMs: now - (binding.panelStartedAt ?? now),
        independentElapsedMs: now - (binding.independentStartedAt ?? now) };
}

function options(binding) {
    const control = binding.control;
    return [{ id: 'open', label: 'Déployer le volet', on: control.motion.to === 1 },
        { id: 'close', label: 'Replier le volet', on: control.motion.to === 0 },
        ...modes.map(([id, label]) => ({ id: 'mode:' + id, label, on: control.mode === id })),
        ...switches.map(([id, label]) => ({ id, label, on: Boolean(control[id]) })),
        ...[...cornerChoices].map(([id, label]) => ({ id, label, on: cornerChoice(control) === id }))];
}

module.exports = { initial, command, stop, snapshot, options };
