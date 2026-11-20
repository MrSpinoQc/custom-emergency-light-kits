local M = { renderer = 'kuruma-optics-v1' }
local zero = { x = 0, y = 0, z = 0 }
local palette = { rouge = 'r', bleu = 'b', blanc = 'w', jaune = 'y' }
local opticalCounts = { 10, 3, 3, 2, 2, 3, 3 }

function M.validate(raw, validators)
    local number = type(raw.id) == 'string' and raw.id:match('^kuruma%-(0[1-7])$')
    local count = number and opticalCounts[tonumber(number)]
    if not count or raw.model ~= 'ta01_kuruma_' .. number .. '_v04'
        or not validators.vec(raw.position, 6) or not validators.vec(raw.rotation, 180)
        or not validators.dense(raw.optics, count, count) then return end

    local registry, colors, geometry = {}, {}, { raw.model }
    for index, optic in ipairs(raw.optics) do
        local id = 'group:' .. index
        if type(optic) ~= 'table' or optic.id ~= id or type(optic.variants) ~= 'table' or not palette[optic.base] then return end
        local prefix = ('ta01_kuruma_%s_g%02d_'):format(number, index)
        local variantCount = 0
        for color, model in pairs(optic.variants) do
            if not palette[color] or model ~= prefix .. palette[color] then return end
            variantCount = variantCount + 1
        end
        if variantCount ~= 4 then return end
        registry[id] = true
        colors[id] = { rouge = true, bleu = true, blanc = true, jaune = true }
        geometry[#geometry + 1] = optic.base
    end
    return { id = raw.id, model = raw.model, kind = M.renderer, position = raw.position, rotation = raw.rotation,
        optics = raw.optics, registry = registry, palette = colors, geometry = table.concat(geometry, '|') }
end

-- Resolve all colors for a selected scene ahead of Q. The supplied models share the body pivot.
function M.plan(part, timeline)
    local needed = {}
    local tracks = timeline and timeline.enabled and timeline.tracks[part.id]
    if part.projector then
        for _, optic in ipairs(part.optics) do needed[optic.variants[optic.base]] = true end
    elseif tracks then
        for _, optic in ipairs(part.optics) do
            local clips = tracks[optic.id]
            for _, clip in ipairs(clips or {}) do
                if clip.projection == true then return false end
                if clip.level > 0 then needed[optic.variants[clip.colorId or optic.base]] = true end
            end
        end
    elseif not timeline and part.original then
        for index, optic in ipairs(part.optics) do
            for _, step in ipairs(part.original.steps) do
                if step.levels[index] > 0 then needed[optic.variants[optic.base]] = true end
            end
        end
    end
    local ordered = {}
    for model in pairs(needed) do ordered[#ordered + 1] = model end
    table.sort(ordered)
    part.needed, part.models = needed, ordered
    return true
end

function M.remove(cache, discard)
    local clean = true
    for model, slot in pairs(cache.lenses) do
        if discard(slot) then cache.lenses[model] = nil else clean = false end
    end
    if not discard(cache.body) then clean = false end
    return clean
end

local function attached(slot, entity, target, position, rotation, native, alwaysVisible)
    if not IsEntityAttachedToEntity(entity, target) then
        native.lens(slot, entity, 0)
        native.attach(entity, target, position, rotation)
    end
    if not IsEntityAttachedToEntity(entity, target) then return false end
    if alwaysVisible and not slot.visible then native.lens(slot, entity, 100) end
    return true
end

local function originalLevels(original, elapsed)
    if not original or not elapsed then return end
    local phase = elapsed % original.period
    for _, step in ipairs(original.steps) do
        if phase < step.duration then return step.levels end
        phase = phase - step.duration
    end
end

function M.draw(state, part, selected, elapsed, now, native, sample)
    local cache = state.parts[part.id]
    if not cache then
        cache = { part = part, body = { initiallyHidden = true, metrics = state.kurumaMetrics,
            diagnostic = part.diagnostics and part.id }, lenses = {}, active = {} }
        state.parts[part.id] = cache
    end
    cache.part = part

    local body = native.create(cache.body, part.model, native.offset(state.vehicle, part.position), now)
    if not body or not attached(cache.body, body, state.vehicle, part.position, part.rotation, native, true) then
        for _, slot in pairs(cache.lenses) do
            if native.valid(slot) then native.lens(slot, slot.object, 0) end
        end
        cache.active = {}
        return
    end

    for model, slot in pairs(cache.lenses) do
        if not part.needed[model] and native.discard(slot) then cache.lenses[model] = nil end
    end
    for _, model in ipairs(part.models) do
        local slot = cache.lenses[model]
        if not slot then
            slot = { initiallyHidden = true, metrics = state.kurumaMetrics, diagnostic = part.diagnostics and part.diagnostics[model] }
            cache.lenses[model] = slot
        end
        local object = native.valid(slot) and slot.object
        if not object and state.kurumaAllocationBudget > 0 and (not slot.retry or now >= slot.retry) then
            state.kurumaAllocationBudget = state.kurumaAllocationBudget - 1
            object = native.create(slot, model, native.offset(body, zero), now)
        end
        if object then attached(slot, object, body, zero, zero, native, false) end
    end

    local original = not selected and originalLevels(part.original, elapsed)
    for index, optic in ipairs(part.optics) do
        local level, projection, color
        if part.projector then level = part.projector.on and 100 or 0
        elseif original then level = original[index]
        elseif elapsed then level, projection, color = sample(selected, part.id, optic.id, elapsed, true) end
        local chosen = level and level > 0 and optic.variants[color or optic.base] or nil
        local old = cache.active[optic.id]
        if old and old ~= chosen then
            local previous = cache.lenses[old]
            if previous and native.valid(previous) then native.lens(previous, previous.object, 0) end
        end
        local slot = chosen and cache.lenses[chosen]
        if slot and native.valid(slot) and IsEntityAttachedToEntity(slot.object, body) then
            native.lens(slot, slot.object, level)
            if optic.diffusion then native.diffusion(optic.diffusion, optic.color, body, level, projection) end
            cache.active[optic.id] = chosen
        else
            cache.active[optic.id] = nil
        end
    end
end

function M.metrics(state, valid)
    local bodies, overlays, visible, expected, unavailable = 0, 0, 0, 0, 0
    local bodyIds, visibleModels = {}, {}
    for id, cache in pairs(state.parts) do
        if cache.part.kind == M.renderer then
            if valid(cache.body) and IsEntityAttachedToEntity(cache.body.object, state.vehicle) then
                bodies = bodies + 1
                bodyIds[id] = cache.body.object
            end
            expected = expected + #cache.part.models
            for model, slot in pairs(cache.lenses) do
                if cache.part.needed[model] then
                    if slot.unavailable then unavailable = unavailable + 1 end
                    if valid(slot) and valid(cache.body) and IsEntityAttachedToEntity(slot.object, cache.body.object) then
                        overlays = overlays + 1
                        if IsEntityVisible(slot.object) then
                            visible = visible + 1
                            visibleModels[#visibleModels + 1] = model
                        end
                    end
                end
            end
        end
    end
    return { bodies = bodies, overlays = overlays, visible = visible, expected = expected, unavailable = unavailable,
        requests = state.kurumaMetrics.requests, created = state.kurumaMetrics.created,
        bodyIds = bodyIds, visibleModels = visibleModels }
end

Dev01 = Dev01 or {}
Dev01.KurumaV05 = M
