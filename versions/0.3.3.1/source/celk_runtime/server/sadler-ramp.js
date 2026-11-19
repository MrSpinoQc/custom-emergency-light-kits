'use strict';

const fs = require('node:fs');
const path = require('node:path');
const contract = require('./sadler-contract.cjs');
const cadences = require('./sadler-cadences.js');
const { expectedDiffusionAxis } = require('./diffusion-axis.js');
const { attachProjectionProfiles } = require('./projection-import.js');
const profile = require('./profil-moteur-centre-v2.json');

const renderer = 'sadler-ramp-v1';
const resource = 'tryagain_sadler_rampe';
const packId = 'sadler-rampe-relevable';
const packVersion = '0.1.0';
const descriptorKeys = ['schema', 'version', 'id', 'packVersion', 'author', 'studioRevision', 'renderer', 'files'];

function check(condition, message) {
    if (!condition) throw new Error('Sadler : ' + message);
}

function readPack(base, spec, descriptor, streamDeclarations) {
    check(Object.keys(descriptor).length === descriptorKeys.length &&
        descriptorKeys.every(key => Object.hasOwn(descriptor, key)) &&
        descriptor.version === 2 && descriptor.id === packId && spec.version === packVersion &&
        spec.resource === resource && descriptor.studioRevision === contract.revision &&
        typeof descriptor.author === 'string' && descriptor.author.length > 0 && descriptor.author.length <= 120 &&
        descriptor.files && Object.getPrototypeOf(descriptor.files) === Object.prototype, 'manifeste Studio incompatible');
    const reference = contract.studioFrom(fs.readFileSync(path.join(__dirname, 'sadler-studio-v01.json')));
    const stream = contract.inspectStream(base, reference);
    check(Object.keys(stream).length === Object.keys(descriptor.files).length &&
        Object.entries(stream).every(([file, sha]) => descriptor.files[file] === sha), 'inventaire différent du Studio');
    const manifest = path.join(base, 'fxmanifest.lua');
    const stat = fs.lstatSync(manifest);
    check(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 8192,
        'manifeste FiveM absent ou invalide');
    streamDeclarations(fs.readFileSync(manifest, 'utf8'), new Set([reference.collection.fichier]), spec.version);
    return { id: packId, version: spec.version, resource, renderer, reference, cadence: cadences.read(reference),
        assets: Object.keys(reference.drawables),
        types: [path.posix.basename(reference.collection.fichier, '.ytyp')] };
}

function vector([x, y, z]) {
    return { x, y, z };
}

function compileMount(bytes, doc, model, service, packs) {
    check(model === 'sadler' && packs.length === 1 && packs[0].renderer === renderer,
        'le montage nécessite uniquement le pack Sadler V01 et le modèle GTA sadler');
    const plan = contract.compileMount(doc, packs[0].reference, service);
    const part = { id: plan.pieceKey, name: 'Rampe relevable Sadler', slot: 'sadler-rampe-relevable',
        model: plan.bodies.fixed, position: vector(plan.position), rotation: vector(plan.rotation) };
    const optics = Object.fromEntries(plan.optics.flatMap((optic, index) => {
        const author = optic.diffusion;
        if (author.rangeM === undefined) return [];
        const axis = expectedDiffusionAxis(optic.axis, author.yawDeg, author.pitchDeg);
        const rgb = Object.values(optic.palette)[0].rgb;
        return [[`group:${index + 1}`, { ...author, emitters: [{ id: optic.id, origin: optic.origin, axis }], rgb }]];
    }));
    const geometry = contract.sha256(bytes);
    const [projected] = attachProjectionProfiles([{ ...part, optics }], { profile, exportSha256: geometry });
    const cadence = packs[0].cadence;
    const compiledPlan = { ...plan, ...(cadence ? { cadence } : {}), optics: plan.optics.map((optic, index) => {
        const projection = projected.optics[`group:${index + 1}`];
        return projection ? { ...optic, projection } : optic;
    }) };
    const library = { original: undefined, defaultId: '', byId: new Map(), choices: [] };
    return { parts: [part], renderedParts: [{ ...part, kind: renderer, sadler: compiledPlan, geometry }], library };
}

module.exports = { renderer, readPack, compileMount };
