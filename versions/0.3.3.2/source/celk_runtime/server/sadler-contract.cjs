'use strict';

const { createHash } = require('node:crypto');
const { readFileSync, lstatSync, realpathSync, readdirSync } = require('node:fs');
const path = require('node:path');

const version = '0.3.3-sadler-prevol.1';
const capability = 'sadlerHingedRamp';
const revision = 'DEV-01-SADLER-RAMPE-3.3-STUDIO-v01';
const studioSha256 = 'fec2d6710b4a736ac46011d921131109a5dc30fefbd8f7580ffc4309d68908e1';
const axes = { space: 'vehicle', position: 'metres', rotation: 'degrees', eulerOrder: 'ZXY', up: '+Z', forward: '+Y' };
const serviceFor = new Map([['police', 'police'], ['remorqueur', 'mecano']]);
const policies = Object.freeze({ corners: 'q-police-priority', closed: 'explicit-rearm', extra: 'unchanged' });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const duration = n => Number.isInteger(n) && finite(n, 1, 30000);
const triple = (value, bound) => Array.isArray(value) && value.length === 3 && value.every(n => finite(n, -bound, bound));

function requireValid(condition, message) {
    if (!condition) throw Error('Sadler : ' + message);
}

function exact(value, fields) {
    return plain(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function studioFrom(bytes) {
    requireValid(Buffer.isBuffer(bytes) && sha256(bytes) === studioSha256, 'descriptif Studio V01 divergent');
    const studio = JSON.parse(bytes.toString('utf8'));
    requireValid(studio.revision === revision && studio.optiques.length === 17 &&
        studio.optiques.filter(optic => optic.parent === 'fixe').length === 10 &&
        studio.optiques.filter(optic => optic.parent === 'volet').length === 7, 'inventaire Studio inattendu');
    return studio;
}

function inspectStream(root, studio) {
    const folder = path.resolve(root, 'stream');
    requireValid(lstatSync(folder).isDirectory() && realpathSync(folder) === folder, 'dossier de flux invalide');
    const expected = [...Object.values(studio.drawables), studio.collection];
    requireValid(expected.length === 24, 'inventaire de flux inattendu');
    const names = expected.map(file => path.basename(file.fichier)).sort();
    const actual = readdirSync(folder).sort();
    requireValid(actual.length === names.length && actual.every((name, index) => name === names[index]),
        'fichier de flux absent ou inattendu');
    for (const file of expected) {
        const target = path.join(folder, path.basename(file.fichier));
        const stat = lstatSync(target);
        requireValid(stat.isFile() && !stat.isSymbolicLink() && stat.size > 4 && stat.size <= 8 * 1024 * 1024,
            'flux non régulier : ' + file.fichier);
        const bytes = readFileSync(target);
        requireValid(bytes.toString('ascii', 0, 4) === 'RSC7' && sha256(bytes) === file.sha256,
            'format ou empreinte différente : ' + file.fichier);
    }
    return Object.fromEntries(expected.map(file => [file.fichier, file.sha256]));
}

function readDiffusions(authored, studio) {
    requireValid(plain(authored), 'diffusions auteur invalides');
    const optics = new Map(studio.optiques.map(optic => [optic.opticId, optic]));
    return Object.fromEntries(Object.entries(authored).map(([id, settings]) => {
        requireValid(optics.has(id) &&
            exact(settings, ['enabled', 'rangeM', 'openingDeg', 'intensity', 'falloff', 'yawDeg', 'pitchDeg']) &&
            typeof settings.enabled === 'boolean' && finite(settings.rangeM, 0, 60) &&
            finite(settings.openingDeg, 1, 179.999999) && finite(settings.intensity, 0, 20) &&
            finite(settings.falloff, 0, 100) && finite(settings.yawDeg, -180, 180) && finite(settings.pitchDeg, -90, 90),
        'réglages de diffusion invalides : ' + id);
        return [id, { ...settings }];
    }));
}

function compileMount(doc, studio, service) {
    requireValid(exact(doc, ['schema', 'version', 'axes', 'project']) && doc.schema === 'tryagain.vehicle-mount' &&
        doc.version === 1 && exact(doc.axes, Object.keys(axes)) &&
        Object.entries(axes).every(([key, value]) => doc.axes[key] === value), 'format de montage ou repère différent');
    const project = doc.project;
    requireValid(exact(project, ['name', 'vehicle', 'attachments']) && project.vehicle === 'sadler' &&
        typeof project.name === 'string' && project.name.length > 0 && project.name.length <= 96 &&
        Array.isArray(project.attachments) && project.attachments.length === 1, 'la rampe demande une pose Sadler unique');
    const [part] = project.attachments;
    requireValid(exact(part, ['key', 'model', 'position', 'rotation', 'sadler']) &&
        part.key === studio.pieceKey && part.model === studio.articulation.modelePorteur &&
        triple(part.position, 12) && triple(part.rotation, 180), 'identité ou pose de rampe invalide');
    const mechanics = part.sadler;
    requireValid(exact(mechanics, ['capabilities', 'studioRevision', 'variant', 'mode', 'travel', 'diffusions']) &&
        exact(mechanics.capabilities, [capability]) && mechanics.capabilities[capability] === 1 &&
        mechanics.studioRevision === revision && serviceFor.has(mechanics.variant) && serviceFor.get(mechanics.variant) === service &&
        Object.hasOwn(studio.signalisation.modes, mechanics.mode) &&
        exact(mechanics.travel, ['raiseMs', 'lowerMs']) &&
        duration(mechanics.travel.raiseMs) && duration(mechanics.travel.lowerMs),
    'capacité v1, service, mode et deux durées de course valides requis');
    const diffusions = readDiffusions(mechanics.diffusions, studio);
    const { articulation } = studio;
    return {
        pieceKey: part.key, position: [...part.position], rotation: [...part.rotation],
        model: 'sadler', service, variant: mechanics.variant, mode: mechanics.mode, travel: { ...mechanics.travel },
        bodies: { fixed: articulation.modelePorteur, moving: articulation.modeleMobile },
        hinge: { offset: articulation.pivotLocalGtaM, axis: articulation.axeLocalGta,
            closedDeg: articulation.anglesDeg.replie, openedDeg: articulation.anglesDeg.ouvert },
        modes: studio.signalisation.modes,
        optics: studio.optiques.map(row => ({
            id: row.opticId, parent: row.parent, group: row.groupe,
            origin: row.diffusion.origineLocaleGtaM, axis: row.diffusion.axeLocalGta, palette: row.modelesEmissifs,
            diffusion: diffusions[row.opticId] ?? { enabled: false },
        })),
        logicalParts: 1, bodyCount: 2, opticCount: 17,
        extra: { slot: 6, compatibleWhenEnabled: false, changesNativeState: false },
    };
}

module.exports = { version, capability, revision, studioSha256, policies, sha256, studioFrom, inspectStream, compileMount };
