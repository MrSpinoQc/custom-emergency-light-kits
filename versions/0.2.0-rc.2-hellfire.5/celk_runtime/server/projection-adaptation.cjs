'use strict';

// Mechanical CommonJS port of Atelier adaptation-projection.mjs. See the parity test.
const authorFields = ['rangeM', 'openingDeg', 'intensity', 'falloff'];
const nativeFields = ['hardness', 'nativeSizeScale'];
const overrideFields = [...authorFields, ...nativeFields];
const gainFields = ['rangeM', 'intensity', 'falloff'];
const degrees = (radians) => radians * 180 / Math.PI;
const radians = (degrees) => degrees * Math.PI / 180;
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const opticKey = ({ pieceKey, opticId }) => JSON.stringify([pieceKey, opticId]);

function check(value, label) {
  if (!value) throw new Error('Raccord de projection · ' + label);
}

function checkSettings(settings) {
  check(settings && authorFields.every((field) => Number.isFinite(settings[field])), 'valeurs de projection invalides');
  check(settings.rangeM > 0 && settings.openingDeg > 0 && settings.openingDeg < 180 &&
    settings.intensity >= 0 && settings.falloff >= 0, 'valeurs de projection hors domaine');
}

function checkNative(settings) {
  check(Number.isFinite(settings.hardness) && settings.hardness >= 0 && settings.hardness <= 1 &&
    Number.isFinite(settings.nativeSizeScale) && settings.nativeSizeScale > 0, 'paramètres natifs invalides');
}

function checkProfile(profile) {
  check(profile?.schema === 'tryagain.fivem-projection-engine' && profile.version === 2 &&
    profile.id === 'centre-mono-v2' && profile.native === 'DrawSpotLight' && profile.appliesTo === 'lens-diffusion',
  'version ou domaine du profil moteur non reconnu');
}

function bindProjectionPresets({ profile, registry, bindings, exportSha256, optics }) {
  checkProfile(profile);
  const selected = new Map();
  if (bindings === undefined) return selected;
  check(bindings?.schema === 'tryagain.fivem-projection-bindings' && bindings.version === 1 &&
    bindings.engineProfile === profile.id && bindings.exportSha256 === exportSha256 && /^[a-f0-9]{64}$/i.test(exportSha256) &&
    Array.isArray(bindings.optics), 'liaisons incompatibles avec la révision ou l’empreinte du montage');
  check(registry?.schema === 'tryagain.fivem-projection-presets' && registry.version === 1 &&
    registry.engineProfile === profile.id && Array.isArray(registry.presets), 'registre de préréglages incompatible');
  const available = new Map(registry.presets.map((preset) => [preset.id, preset]));
  check(available.size === registry.presets.length, 'identifiants de préréglages en double');
  const known = new Set(optics.map(opticKey));
  for (const binding of bindings.optics) {
    const key = opticKey(binding);
    const preset = available.get(binding.presetId);
    check(known.has(key) && !selected.has(key) && preset, 'optique absente, dupliquée ou préréglage inconnu');
    check(Object.keys(preset.settings).length === overrideFields.length && Object.keys(preset.settings).every((field) => overrideFields.includes(field)),
      'un préréglage peut modifier seulement les paramètres du moteur');
    checkSettings(preset.settings);
    checkNative(preset.settings);
    selected.set(key, preset);
  }
  return selected;
}

const isVector = (values) => Array.isArray(values) && values.length === 3 && values.every(Number.isFinite);
const isColor = (values) => isVector(values) && values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255);

function createCentreAdapter(profile) {
  checkProfile(profile);
  const { centre, unassigned } = profile;
  checkNative(unassigned.narrow);
  checkNative(unassigned.wide);
  const gains = Object.fromEntries(gainFields.map((field) => {
    const { target, authorAnchor } = unassigned.wide.gainRatios?.[field] ?? {};
    check(Number.isFinite(target) && target > 0 && Number.isFinite(authorAnchor) && authorAnchor > 0, `gain ${field} invalide`);
    return [field, target / authorAnchor];
  }));

  function engineDefaults(author) {
    const wide = author.openingDeg > centre.wideOpeningThresholdDeg;
    const { hardness, nativeSizeScale } = wide ? unassigned.wide : unassigned.narrow;
    const adjusted = wide ? Object.fromEntries(gainFields.map((field) => [field, author[field] * gains[field]])) : {};
    return { ...author, ...adjusted, hardness, nativeSizeScale };
  }

  return function projectionAtPhase(source, { level, projectionEnabled, color = source.color }, selection = new Map()) {
    check(source.projectionKind === undefined || source.projectionKind === profile.appliesTo, 'utiliser la voie des projecteurs de scène');
    check(Number.isFinite(level) && level >= 0 && level <= 100 && typeof projectionEnabled === 'boolean', 'état de phase invalide');
    if (!projectionEnabled || source.enabled === false || level === 0) return null;

    const { author, originLocalM, axisLocal, exposedFaceNormalLocal, pieceKey, opticId, sourceId } = source;
    checkSettings(author);
    if (author.intensity === 0) return null;
    check(isVector(originLocalM) && isVector(axisLocal) && isColor(color), 'émetteur ou couleur invalide');
    const axisLength = Math.hypot(...axisLocal);
    check(axisLength > 0, 'axe optique nul');

    const preset = selection.get(opticKey(source));
    const effective = preset?.settings ?? engineDefaults(author);
    checkSettings(effective);
    const wide = effective.openingDeg > centre.wideOpeningThresholdDeg;
    const weight = wide ? centre.wideBrightnessWeight : centre.narrowBrightnessWeight;
    const halfOpening = effective.openingDeg / 2;
    let halfAngleDeg = wide ? Math.min(centre.wideMaxHalfAngleDeg, centre.wideHalfAngleFactor * halfOpening) : halfOpening;
    if (exposedFaceNormalLocal !== undefined) {
      check(isVector(exposedFaceNormalLocal) && Math.hypot(...exposedFaceNormalLocal) > 0, 'normale de face exposée invalide');
      const outward = dot(axisLocal, exposedFaceNormalLocal) / (axisLength * Math.hypot(...exposedFaceNormalLocal));
      halfAngleDeg = Math.min(halfAngleDeg, degrees(Math.asin(Math.max(0, Math.min(1, outward)))) - centre.exposedFaceMarginDeg);
    }
    if (halfAngleDeg <= 0 || effective.intensity === 0) return null;

    return { native: profile.native, engineProfile: profile.id, presetId: preset?.id ?? null, pieceKey, opticId, sourceId,
      originLocalM: [...originLocalM], axisLocal: [...axisLocal], color: [...color],
      rangeM: effective.rangeM, halfAngleDeg, brightness: effective.intensity * weight * level / 100,
      hardness: effective.hardness, falloff: effective.falloff,
      nativeSizeArgument: effective.rangeM * Math.tan(radians(halfAngleDeg)) * effective.nativeSizeScale };
  };
}

module.exports = { bindProjectionPresets, createCentreAdapter };
