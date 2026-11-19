'use strict';

const { createHash } = require('node:crypto');
const { attachProjectionProfiles } = require('./projection-import.js');
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const signature = value => JSON.stringify(ordered(value));
const digest = value => createHash('sha256').update(value).digest('hex');

// Render coefficients are a view of the imported data. They never enter the
// author catalogue or vehicle saves, whose exact descriptors identify old fits.
function createProjectionView({ profile, references = [] }) {
    const calibrated = new Map();
    const defaults = new Map();
    for (const reference of references) {
        if (calibrated.has(reference.exportSha256)) throw new Error('Projection : empreinte répétée');
        const compiled = attachProjectionProfiles(reference.parts, { ...reference, profile });
        calibrated.set(reference.exportSha256, new Map(reference.parts.map((part, i) => [signature(part), compiled[i]])));
    }
    function parts(authoredParts, exportSha256) {
        const explicit = calibrated.get(exportSha256);
        return authoredParts.map(part => {
            const key = signature(part);
            if (explicit?.has(key)) return explicit.get(key);
            if (explicit) throw new Error('Projection : pièce différente de l’export lié : ' + (part.pieceKey ?? part.id));
            if (!Object.keys(part.optics ?? {}).some(id => /^group:[1-9]\d?$/.test(id))) return part;
            if (!defaults.has(key)) {
                const compiled = attachProjectionProfiles([part], { profile, exportSha256: digest(key) })[0];
                if (defaults.size >= 512) defaults.clear();
                defaults.set(key, compiled);
            }
            return defaults.get(key);
        });
    }
    return { parts, engineProfile: profile.id };
}

module.exports = { createProjectionView };
