'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('./sadler-contract.cjs');

const recipeSha256 = '710d13b117f7e157ca63e18e65b30a9f9bf514468bce16a473f6c185dcd52fe3';

function need(condition, message) {
    if (!condition) throw new Error('Sadler cadences : ' + message);
}

function exact(object, keys) {
    return object != null && Object.getPrototypeOf(object) === Object.prototype &&
        Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));
}

const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

function compileCycle(cycle, allowed, label) {
    need(exact(cycle, ['durationMs', 'phases']) && integer(cycle.durationMs, 1, 300000) &&
        Array.isArray(cycle.phases) && integer(cycle.phases.length, 1, 64), 'cycle invalide : ' + label);
    let stop = 0;
    const phases = cycle.phases.map(phase => {
        need(exact(phase, ['startMs', 'endMs', 'lit']) && phase.startMs === stop &&
            integer(phase.endMs, stop + 1, cycle.durationMs) && Array.isArray(phase.lit) &&
            phase.lit.every(id => allowed.has(id)) && new Set(phase.lit).size === phase.lit.length,
        'phase invalide ou optique inconnue : ' + label);
        stop = phase.endMs;
        return { startMs: phase.startMs, endMs: phase.endMs, lit: [...phase.lit] };
    });
    need(stop === cycle.durationMs, 'cycle incomplet : ' + label);
    return { durationMs: stop, phases };
}

function compile(document, studio) {
    const modes = studio.signalisation.modes;
    need(exact(document, ['panel', 'amber', 'police']) && exact(document.panel, Object.keys(modes)),
        'les quatre motifs J, les coins ambre et le cycle Q sont requis');
    const corners = new Set(studio.optiques.filter(optic => optic.groupe === 'coins-fixes').map(optic => optic.opticId));
    const panel = Object.fromEntries(Object.entries(modes).map(([mode, ids]) =>
        [mode, compileCycle(document.panel[mode], new Set(ids), 'J/' + mode)]));
    return { panel, amber: compileCycle(document.amber, corners, 'J/coins'),
        police: compileCycle(document.police, corners, 'Q/Police') };
}

function sameMembers(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length &&
        expected.every(value => actual.includes(value));
}

function toggledCycle(source, ids) {
    need(Array.isArray(source.phases), 'liste de phases J absente');
    return { durationMs: source.cycleMs, phases: source.phases.map(phase => {
        need(exact(phase, ['startMs', 'endMs', 'on']) && typeof phase.on === 'boolean', 'état de phase J invalide');
        return { startMs: phase.startMs, endMs: phase.endMs, lit: phase.on ? ids : [] };
    }) };
}

function compileRecipe(document, studio) {
    need(exact(document, ['schema', 'version', 'revision', 'studioRevision', 'phaseBounds', 'panelJ', 'cornersJ', 'policeQ']) &&
        document.schema === 'tryagain.sadler-cadences' && document.version === 1 &&
        document.revision === 'DEV-01-SADLER-CADENCES-RECETTE-v01' && document.studioRevision === studio.revision &&
        document.phaseBounds === '[startMs,endMs)', 'identité de la recette Atelier incompatible');
    const { panelJ, cornersJ, policeQ } = document;
    const modes = studio.signalisation.modes;
    const corners = studio.optiques.filter(optic => optic.groupe === 'coins-fixes').map(optic => optic.opticId);
    need(exact(panelJ, ['cycleMs', 'phases', 'modes', 'restartOn']) &&
        sameMembers(panelJ.modes, Object.keys(modes)) && sameMembers(panelJ.restartOn, ['arm', 'mode-change-while-armed']),
    'horloge du volet incompatible');
    need(exact(cornersJ, ['cycleMs', 'phases', 'opticIds', 'independentRestartOn', 'linkedUses', 'simultaneousUses']) &&
        sameMembers(cornersJ.opticIds, corners) && cornersJ.independentRestartOn === 'independent-enable' &&
        cornersJ.linkedUses === 'panelJ' && cornersJ.simultaneousUses === 'independent', 'horloges des coins ambre incompatibles');
    need(exact(policeQ, ['cycleMs', 'restartOn', 'phases']) && policeQ.restartOn === 'lvc-engaged' &&
        Array.isArray(policeQ.phases), 'horloge Q incompatible');
    const police = { durationMs: policeQ.cycleMs, phases: policeQ.phases.map(phase => {
        need(exact(phase, ['startMs', 'endMs', 'opticIds']), 'phase Q invalide');
        return { startMs: phase.startMs, endMs: phase.endMs, lit: phase.opticIds };
    }) };
    const panel = Object.fromEntries(Object.entries(modes).map(([mode, ids]) => [mode, toggledCycle(panelJ, ids)]));
    return compile({ panel, amber: toggledCycle(cornersJ, cornersJ.opticIds), police }, studio);
}

function read(studio) {
    const file = path.join(__dirname, 'sadler-cadences-v01.json');
    const stat = fs.lstatSync(file);
    need(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 64 * 1024, 'fichier approuvé invalide');
    const bytes = fs.readFileSync(file);
    need(sha256(bytes) === recipeSha256, 'empreinte de la recette Atelier différente');
    return compileRecipe(JSON.parse(bytes), studio);
}

module.exports = { compile, compileRecipe, read };
