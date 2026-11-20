'use strict';

function initial(plan) {
    return { mode: plan.mode, motion: { from: 0, to: 0, startedAt: 0, duration: 0 },
        armed: false, linkedCorners: false, independentCorners: false, serviceLights: false };
}

function position(motion, now) {
    if (!motion.duration) return motion.to;
    const elapsed = Math.max(0, Math.min(motion.duration, now - motion.startedAt));
    return motion.from + (motion.to - motion.from) * elapsed / motion.duration;
}

function move(plan, state, to, now) {
    if (![0, 1].includes(to) || !Number.isFinite(now)) throw Error('Cible de déplacement invalide');
    if (state.motion.to === to) return state;
    const from = position(state.motion, now);
    const duration = Math.abs(to - from) * (to === 1 ? plan.travel.raiseMs : plan.travel.lowerMs);
    return { ...state, motion: { from, to, startedAt: now, duration }, armed: false, linkedCorners: false };
}

function action(plan, state, command, value, now) {
    if (command === 'mode') {
        if (!Object.hasOwn(plan.modes, value)) throw Error('Mode de panneau inconnu');
        return { ...state, mode: value };
    }
    if (typeof value !== 'boolean') throw Error('Valeur de commande invalide');
    if (command === 'armed' || command === 'linkedCorners') {
        if (value && (state.motion.to !== 1 || position(state.motion, now) !== 1)) return state;
    } else if (command !== 'independentCorners' && command !== 'serviceLights') {
        throw Error('Commande J inconnue');
    }
    return { ...state, [command]: value };
}

function output(plan, state, now, phase) {
    const fraction = position(state.motion, now);
    const open = state.motion.to === 1 && fraction === 1;
    const panel = open && state.armed && phase.panelOn;
    const panelOptics = new Set(panel ? plan.modes[state.mode] : []);
    const qOwnsCorners = plan.service === 'police' && phase.qActive;
    const amber = state.independentCorners || (open && state.armed && state.linkedCorners);
    const active = [];
    for (const optic of plan.optics) {
        let color;
        if (optic.parent === 'volet') {
            if (panelOptics.has(optic.id)) color = 'ambre';
        } else if (optic.group === 'coins-fixes') {
            if (qOwnsCorners) {
                if (phase.qLit?.includes(optic.id)) color = optic.palette.rouge ? 'rouge' : 'bleu';
            } else if (amber && phase.amberOn) color = 'ambre';
        } else if (state.serviceLights) color = 'blanc';
        if (color) active.push({ id: optic.id, parent: optic.parent, color, diffuse: optic.diffusion.enabled });
    }
    return { fraction, angleDeg: plan.hinge.closedDeg + fraction * (plan.hinge.openedDeg - plan.hinge.closedDeg), active };
}

module.exports = { initial, position, move, action, output };
