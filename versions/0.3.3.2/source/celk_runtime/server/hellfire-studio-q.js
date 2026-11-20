'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual: same } = require('node:util');

const renderer = 'hellfire-optics-studio-v1';
const revision08 = 'DEV-01-GAUNTLET4-POLICE-RAMPE-V08-PROD-v01';
const ramp08 = 'ta01_gh4v8_01';
const definitions = new Map([
    ['hellfire-feux-v07-lab', { version: '0.7.0', revision: 'DEV-01-GAUNTLET4-POLICE-V07-REVUE-v01',
        resource: 'celk_pack_hellfire_v07', file: 'hellfire-v07-atelier.json', parts: 12, drawables: 52,
        sha256: '620fef458044854bbde8a2ab0bff91dcbc872c4a9650508d87c6e61734849706' }],
    ['hellfire-rampe-v08-lab', { version: '0.8.0', revision: revision08, resource: 'celk_pack_hellfire_v08',
        file: 'hellfire-v08-atelier.json', parts: 1, drawables: 11,
        sha256: 'ae00af3c2a4cabb93022b6aae41cb0f42a5614b22239d2f6b592364688828d61' }],
]);
const projectorPoses = new Map([
    ['ta01_gh4v6_12', { position: [-.431, -.395, 1.194145], rotation: [0, 0, 49] }],
    ['ta01_gh4v6_13', { position: [.431, -.395, 1.194144], rotation: [0, 0, -49] }],
]);
const door = { ta01_gh4v7_10: 'door_dside_f', ta01_gh4v7_11: 'door_pside_f' };
const modelPattern = /^ta01_gh4v[78]_[a-z0-9_]+$/;
const shaPattern = /^[a-f0-9]{64}$/;

function check(test, message) {
    if (!test) throw new Error('Catalogue Hellfire Studio · ' + message);
}

function catalogue(id) {
    const definition = definitions.get(id);
    check(definition !== undefined, 'pack inconnu : ' + id);
    const bytes = readFileSync(join(__dirname, definition.file));
    check(createHash('sha256').update(bytes).digest('hex') === definition.sha256, 'source Atelier modifiée : ' + id);
    const doc = JSON.parse(bytes);
    check(doc.schema === 'tryagain.atelier-part-pack' && doc.version === 1 && doc.id === id &&
        doc.packVersion === definition.version && doc.author === 'Spino' && doc.parts.length === definition.parts &&
        same(doc.units, { position: 'm', rotation: 'deg', order: 'ZXY', axes: 'GTA' }), 'schéma ou provenance incorrects : ' + id);
    const drawables = new Map();
    const collections = new Set();
    function drawable(model, file) {
        check(modelPattern.test(model) && file === `stream/${model}.ydr` && !drawables.has(model) &&
            shaPattern.test(doc.files[file]), 'drawable inattendu : ' + model);
        drawables.set(model, { file, sha256: doc.files[file] });
    }
    const parts = doc.parts.map(row => {
        const { id: model, runtime, optics, revision } = row;
        check(revision === definition.revision && row.service === 'police' && same(row.compatibleVehicles, ['gauntlet4']) &&
            same(row.mountPivotM, [0, 0, 0]) && runtime.model === model && modelPattern.test(model) &&
            /^stream\/ta01_gh4v[78]_[a-z0-9_]+\.ytyp$/.test(runtime.ytyp) && shaPattern.test(doc.files[runtime.ytyp]) &&
            Array.isArray(optics) && optics.length >= 1 && optics.length <= 18 && optics.length === runtime.drawables.length,
        'identité de pièce ou liste optique différente : ' + model);
        drawable(model, runtime.ydr);
        collections.add(runtime.ytyp);
        const eyes = optics.map((optic, index) => {
            const { model: mesh, ydr } = runtime.drawables[index];
            const suffix = model === ramp08 ? optic.name : `c${String(index + 1).padStart(2, '0')}`;
            check(optic.id === index + 1 && mesh === `${model}_${suffix.replace('-', '_')}` && optic.faces.length === 1,
                'liaison optique/drawable différente : ' + mesh);
            drawable(mesh, ydr);
            const { originLocalM, axisLocal } = optic.faces[0];
            return { opticIdAtelier: `group:${optic.id}`, opticId: suffix, modelEmissif: mesh, control: 'Q', rgb: optic.color,
                emissionM: originLocalM, axis: axisLocal, rangeM: optic.rangeM, totalAngleDeg: optic.halfAngleDeg * 2,
                intensity: optic.intensity, falloff: 2 };
        });
        const place = row.placements.gauntlet4;
        return { model, revision, optics: eyes, pivotM: row.mountPivotM, fits: door[model] ? { boneCandidate: door[model] } : {},
            poseChassisM: place.positionM, rotationZXYDeg: place.rotationZxyDeg,
            ...(model === ramp08 && { defaultAnimation: doc.animations.find(entry => entry.model === model)?.animation }) };
    });
    check(drawables.size === definition.drawables && collections.size === 1 &&
        Object.keys(doc.files).filter(file => file.startsWith('stream/')).length === drawables.size + collections.size,
    'inventaire de flux incomplet : ' + id);
    const [type] = collections;
    return { ...definition, id, parts, drawables: Object.fromEntries(drawables), collection: { file: type, sha256: doc.files[type] } };
}

module.exports = { renderer, definitions, ramp08, projectorPoses, catalogue };
