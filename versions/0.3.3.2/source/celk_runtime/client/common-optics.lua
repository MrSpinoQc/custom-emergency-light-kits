local M = { renderer = 'celk-optics-v1' }
local zero = { x = 0, y = 0, z = 0 }

local function projector(row, v)
    if type(row) ~= 'table' or type(row.on) ~= 'boolean'
        or not v.bounded(row.yawMin, -180, 0) or not v.bounded(row.yawMax, 0, 180)
        or not v.bounded(row.pitchMin, -90, 0) or not v.bounded(row.pitchMax, 0, 90)
        or not v.bounded(row.yaw, row.yawMin, row.yawMax) or not v.bounded(row.pitch, row.pitchMin, row.pitchMax)
    then return end
    local moving = row.yawMin < row.yawMax or row.pitchMin < row.pitchMax
    if row.mode == 'fixed' and not moving and row.fork == nil and row.head == nil then return row end
    if row.mode == 'articulated' and moving and v.asset(row.fork) and v.asset(row.head)
        and v.vec(row.yawPivot, 6) and v.vec(row.pitchPivot, 6) then return row end
end

local function pattern(row, count, v)
    if type(row) ~= 'table' or not v.dense(row.steps, 1, 32) then return end
    local period = 0
    for _, step in ipairs(row.steps) do
        if type(step) ~= 'table' or not v.integer(step.duration, 40, 5000) or not v.dense(step.levels, count, count) then return end
        for _, level in ipairs(step.levels) do if not v.bounded(level, 0, 100) then return end end
        period = period + step.duration
    end
    if period == row.period and period <= 30000 then return row end
end

function M.validate(raw, v)
    if not v.key(raw.id) or not v.asset(raw.model) or not v.vec(raw.position, 12) or not v.vec(raw.rotation, 180)
        or not v.dense(raw.optics, 1, 16) or (raw.fallbackInScene ~= nil and raw.fallbackInScene ~= true)
        or (raw.sourceKey ~= nil and (type(raw.sourceKey) ~= 'string' or #raw.sourceKey > 64
            or not raw.sourceKey:match('^[%w_%-]+$'))) then return end
    local head = raw.projector ~= nil and projector(raw.projector, v)
    if raw.projector ~= nil and (not head or #raw.optics ~= 1 or raw.original ~= nil) then return end
    local original = raw.original ~= nil and pattern(raw.original, #raw.optics, v)
    if (raw.original ~= nil and not original) or (raw.fallbackInScene and not original) then return end

    local registry, palette, optics = {}, {}, {}
    local geometry, used = { raw.model }, { [raw.model] = true }
    if head and head.mode == 'articulated' then
        if used[head.fork] or used[head.head] or head.fork == head.head then return end
        used[head.fork], used[head.head] = true, true
        for _, value in ipairs({ head.fork, head.head, head.yawPivot.x, head.yawPivot.y, head.yawPivot.z,
            head.pitchPivot.x, head.pitchPivot.y, head.pitchPivot.z }) do geometry[#geometry + 1] = tostring(value) end
    elseif head then geometry[#geometry + 1] = 'fixed' end
    for _, optic in ipairs(raw.optics) do
        if type(optic) ~= 'table' or type(optic.id) ~= 'string' or not optic.id:match('^group:[1-9]%d?$')
            or registry[optic.id] or type(optic.palette) ~= 'table' or type(optic.base) ~= 'string'
            or not optic.palette[optic.base] or (optic.diffusion ~= nil and not v.validDiffusion(optic.diffusion)) then return end
        local variants, names = {}, {}
        for id, tint in pairs(optic.palette) do
            if type(id) ~= 'string' or #id > 32 or not id:match('^[a-z][a-z0-9%-]*$')
                or type(tint) ~= 'table' or not v.asset(tint.model) or used[tint.model] or not v.dense(tint.rgb, 3, 3)
            then return end
            local r, g, b = tint.rgb[1], tint.rgb[2], tint.rgb[3]
            if not v.integer(r, 0, 255) or not v.integer(g, 0, 255) or not v.integer(b, 0, 255) then return end
            used[tint.model], variants[id] = true, { model = tint.model, color = { r = r, g = g, b = b } }
            names[#names + 1] = id
        end
        if #names > 8 then return end
        table.sort(names)
        geometry[#geometry + 1] = optic.id .. ':' .. optic.base
        palette[optic.id] = {}
        for _, id in ipairs(names) do
            geometry[#geometry + 1] = id .. ':' .. variants[id].model
            palette[optic.id][id] = true
        end
        registry[optic.id] = true
        optics[#optics + 1] = { id = optic.id, base = optic.base, variants = variants, diffusion = optic.diffusion }
    end
    return { id = raw.id, model = raw.model, kind = M.renderer, position = raw.position, rotation = raw.rotation,
        optics = optics, registry = head and {} or registry, palette = palette, geometry = table.concat(geometry, '|'),
        sourceKey = raw.sourceKey or raw.id, projector = head or nil, original = original or nil,
        fallbackInScene = raw.fallbackInScene }
end

function M.plan(part, timeline)
    local needed = {}
    local tracks = timeline and timeline.enabled and timeline.tracks[part.id]
    for index, optic in ipairs(part.optics) do
        local base = optic.variants[optic.base].model
        if part.projector or part.fallbackInScene then needed[base] = optic.id end
        for _, clip in ipairs(tracks and tracks[optic.id] or {}) do
            if clip.projection == true and not optic.diffusion then return false end
            if clip.level > 0 then needed[optic.variants[clip.colorId or optic.base].model] = optic.id end
        end
        if not timeline and part.original then
            for _, step in ipairs(part.original.steps) do
                if step.levels[index] > 0 then needed[base] = optic.id; break end
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
    return clean and discard(cache.head) and discard(cache.fork) and discard(cache.body)
end

local function place(slot, parent, model, position, rotation, value, now, native)
    local object = native.create(slot, model, native.offset(parent, position), now)
    if not object then return end
    if not IsEntityAttachedToEntity(object, parent) or slot.angle ~= value then
        native.lens(slot, object, 0)
        native.attach(object, parent, position, rotation)
        slot.angle = value
    end
    if not IsEntityAttachedToEntity(object, parent) then return end
    if not slot.visible then native.lens(slot, object, 100) end
    return object
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
        local function body() return { initiallyHidden = true, metrics = state.opticsMetrics, diagnostic = part.sourceKey } end
        cache = { part = part, body = body(), fork = body(), head = body(), lenses = {}, active = {} }
        state.parts[part.id] = cache
    end
    cache.part = part

    local parent = place(cache.body, state.vehicle, part.model, part.position, part.rotation, 0, now, native)
    local p = part.projector
    if parent and p and p.mode == 'articulated' then
        local fork = place(cache.fork, parent, p.fork, p.yawPivot, { x = 0, y = 0, z = p.yaw }, p.yaw, now, native)
        parent = fork and place(cache.head, fork, p.head, p.pitchPivot, { x = p.pitch, y = 0, z = 0 }, p.pitch, now, native)
    end
    if not parent then
        for _, slot in ipairs({ cache.fork, cache.head }) do
            if native.valid(slot) then native.lens(slot, slot.object, 0) end
        end
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
            slot = { initiallyHidden = true, metrics = state.opticsMetrics, diagnostic = part.sourceKey .. '/' .. part.needed[model] }
            cache.lenses[model] = slot
        end
        local object = native.valid(slot) and slot.object
        if not object and state.opticsAllocationBudget > 0 and (not slot.retry or now >= slot.retry) then
            state.opticsAllocationBudget = state.opticsAllocationBudget - 1
            object = native.create(slot, model, native.offset(parent, zero), now)
        end
        if object and not IsEntityAttachedToEntity(object, parent) then
            native.lens(slot, object, 0)
            native.attach(object, parent, zero, zero)
        end
    end

    local original = (not selected or part.fallbackInScene) and originalLevels(part.original, elapsed)
    for index, optic in ipairs(part.optics) do
        local level, projection, color
        if p then level = p.on and 100 or 0
        elseif elapsed then
            level, projection, color = sample(selected, part.id, optic.id, elapsed, true)
            if level == nil and original then level = original[index] end
        end
        local tint = level and level > 0 and optic.variants[color or optic.base]
        local chosen = tint and tint.model or nil
        local old = cache.active[optic.id]
        if old and old ~= chosen then
            local previous = cache.lenses[old]
            if previous and native.valid(previous) then native.lens(previous, previous.object, 0) end
        end
        local slot = chosen and cache.lenses[chosen]
        if slot and native.valid(slot) and IsEntityAttachedToEntity(slot.object, parent) then
            native.lens(slot, slot.object, level)
            if optic.diffusion then native.diffusion(optic.diffusion, tint.color, parent, level, projection) end
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
            local parent = cache.part.projector and cache.part.projector.mode == 'articulated' and cache.head or cache.body
            for model, slot in pairs(cache.lenses) do
                if cache.part.needed[model] then
                    if slot.unavailable then unavailable = unavailable + 1 end
                    if valid(slot) and valid(parent) and IsEntityAttachedToEntity(slot.object, parent.object) then
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
        requests = state.opticsMetrics.requests, created = state.opticsMetrics.created, bodyIds = bodyIds, visibleModels = visibleModels }
end

Dev01 = Dev01 or {}
Dev01.CommonOptics = M
