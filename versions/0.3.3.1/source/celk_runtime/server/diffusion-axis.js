'use strict';

// L'Atelier exporte déjà l'axe corrigé. Ce calcul sert uniquement à le vérifier.
function expectedDiffusionAxis([x, y, z], yawDeg, pitchDeg) {
    const horizontal = Math.hypot(x, y);
    const radians = Math.PI / 180;
    const heading = (horizontal === 0 ? 0 : Math.atan2(-x, y)) + yawDeg * radians;
    const elevation = Math.atan2(z, horizontal) + pitchDeg * radians;
    const planar = Math.cos(elevation);
    return [-Math.sin(heading) * planar, Math.cos(heading) * planar, Math.sin(elevation)];
}

module.exports = { expectedDiffusionAxis };
