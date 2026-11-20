local M = { renderer = 'sadler-ramp-v1' }
local zero = { x = 0.0, y = 0.0, z = 0.0 }
local colors = { rouge = true, bleu = true, ambre = true, blanc = true }
local modes = { 'ligne', 'gauche', 'droite', 'double' }
local timerRange = 4294967296

local function vector(values)
    return { x = values[1], y = values[2], z = values[3] }
end

local function drawable(value)
    return type(value) == 'string' and value:match('^ta_sadler_rp_e%d%d_[a-z][a-z]$') ~= nil
end

local function cycle(raw, allowed, v)
    if type(raw) ~= 'table' or not v.integer(raw.durationMs, 1, 300000) or not v.dense(raw.phases, 1, 64) then return end
    local stop, phases = 0, {}
    for _, phase in ipairs(raw.phases) do
        if type(phase) ~= 'table' or phase.startMs ~= stop or not v.integer(phase.endMs, stop + 1, raw.durationMs)
            or not v.dense(phase.lit, 0, 7) then return end
        local lit = {}
        for _, id in ipairs(phase.lit) do
            if type(id) ~= 'string' or not allowed[id] or lit[id] then return end
            lit[id] = true
        end
        stop = phase.endMs
        phases[#phases + 1] = { endMs = stop, lit = lit }
    end
    if stop == raw.durationMs then return { durationMs = stop, phases = phases } end
end

local function cadence(raw, plan, optics, v)
    if type(raw) ~= 'table' or type(raw.panel) ~= 'table' then return end
    local compiled = { panel = {} }
    local corners = {}
    for id, group in pairs(optics) do if group == 'coins' then corners[id] = true end end
    for _, mode in ipairs(modes) do
        local ids = plan.modes[mode]
        if not v.dense(ids, 1, 5) then return end
        local allowed = {}
        for _, id in ipairs(ids) do
            if type(id) ~= 'string' or optics[id] ~= 'volet' or allowed[id] then return end
            allowed[id] = true
        end
        compiled.panel[mode] = cycle(raw.panel[mode], allowed, v)
        if not compiled.panel[mode] then return end
    end
    compiled.amber = cycle(raw.amber, corners, v)
    compiled.police = cycle(raw.police, corners, v)
    if compiled.amber and compiled.police then return compiled end
end

function M.validate(raw, state, v, now)
    local plan = raw.sadler
    if raw.id ~= 'sadler-rampe-relevable-01' or raw.model ~= 'ta_sadler_rp_fixe01'
        or not v.vec(raw.position, 12) or not v.vec(raw.rotation, 180)
        or type(raw.geometry) ~= 'string' or #raw.geometry ~= 64 or not raw.geometry:match('^[0-9a-f]+$')
        or type(plan) ~= 'table' or (plan.service ~= 'police' and plan.service ~= 'mecano')
        or type(plan.bodies) ~= 'table' or plan.bodies.moving ~= 'ta_sadler_rp_volet01'
        or type(plan.hinge) ~= 'table' or not v.triple(plan.hinge.offset, 1)
        or plan.hinge.closedDeg ~= 0 or plan.hinge.openedDeg ~= 88
        or not v.dense(plan.optics, 17, 17) or type(plan.modes) ~= 'table' or type(state) ~= 'table'
        or not v.bounded(state.position, 0, 1) or (state.target ~= 0 and state.target ~= 1)
        or not v.bounded(state.remainingMs, 0, 30000) or not v.bounded(state.panelElapsedMs, 0, 9007199254740991)
        or not v.bounded(state.independentElapsedMs, 0, 9007199254740991)
        or type(state.mode) ~= 'string' or not v.dense(plan.modes[state.mode], 1, 5) then return end
    for _, flag in ipairs({ 'armed', 'linkedCorners', 'independentCorners', 'serviceLights', 'paused' }) do
        if type(state[flag]) ~= 'boolean' then return end
    end
    local optics, seen, models = {}, {}, {}
    local count = { volet = 0, coins = 0, service = 0 }
    for _, optic in ipairs(plan.optics) do
        if type(optic) ~= 'table' or not v.key(optic.id) or seen[optic.id]
            or (optic.parent ~= 'volet' and optic.parent ~= 'fixe') or type(optic.palette) ~= 'table'
            or (optic.projection ~= nil and (not v.validDiffusion(optic.projection) or #optic.projection.emitters ~= 1)) then return end
        local group = optic.parent == 'volet' and 'volet' or (optic.group == 'coins-fixes' and 'coins' or 'service')
        local palette, size = {}, 0
        for color, tint in pairs(optic.palette) do
            if not colors[color] or type(tint) ~= 'table' or not drawable(tint.modele) or models[tint.modele]
                or not v.triple(tint.rgb, 255) then return end
            for _, channel in ipairs(tint.rgb) do if not v.integer(channel, 0, 255) then return end end
            palette[color] = { model = tint.modele, rgb = { r = tint.rgb[1], g = tint.rgb[2], b = tint.rgb[3] } }
            models[tint.modele] = true
            size = size + 1
        end
        if group == 'coins' then
            if size ~= 2 or not palette.ambre or (not palette.rouge and not palette.bleu) then return end
        elseif size ~= 1 or not palette[group == 'volet' and 'ambre' or 'blanc'] then return end
        count[group] = count[group] + 1
        optics[#optics + 1] = { id = optic.id, group = group, palette = palette, projection = optic.projection }
        seen[optic.id] = group
    end
    if count.volet ~= 7 or count.coins ~= 4 or count.service ~= 6 then return end
    local phases = cadence(plan.cadence, plan, seen, v)
    if not phases or not phases.panel[state.mode] then return end
    return { id = raw.id, model = raw.model, kind = M.renderer, geometry = raw.geometry,
        position = raw.position, rotation = raw.rotation, pose = state, receivedAt = now,
        movingModel = plan.bodies.moving, pivot = vector(plan.hinge.offset),
        service = plan.service, optics = optics, phases = phases }
end

function M.position(part, now)
    local pose = part.pose
    if pose.remainingMs <= 0 then return pose.target end
    local progress = math.min(1, ((now - part.receivedAt) % timerRange) / pose.remainingMs)
    return pose.position + (pose.target - pose.position) * progress
end

local function phaseAt(cycle, elapsed)
    local cursor = elapsed % cycle.durationMs
    for _, phase in ipairs(cycle.phases) do if cursor < phase.endMs then return phase.lit end end
end

function M.phase(part, now, qActive, qElapsed)
    local delta = (now - part.receivedAt) % timerRange
    local pose = part.pose
    local phases = part.phases
    return { panelLit = phaseAt(phases.panel[pose.mode], pose.panelElapsedMs + delta),
        amberLit = phaseAt(phases.amber, pose.independentElapsedMs + delta),
        qActive = qActive, qLit = qActive and qElapsed and phaseAt(phases.police, qElapsed) or nil }
end

local function colorFor(part, optic, open, phase)
    local pose = part.pose
    if optic.group == 'service' and pose.serviceLights then return 'blanc' end
    if optic.group == 'volet' and open and pose.armed and not pose.paused and phase.panelLit[optic.id] then
        return 'ambre'
    end
    if optic.group ~= 'coins' then return end
    if part.service == 'police' and phase.qActive then
        if phase.qLit and phase.qLit[optic.id] then return optic.palette.rouge and 'rouge' or 'bleu' end
    elseif not pose.paused then
        if pose.independentCorners then
            if phase.amberLit[optic.id] then return 'ambre' end
        elseif open and pose.armed and pose.linkedCorners and next(phase.panelLit) then return 'ambre' end
    end
end

local function clip(slot, parent, model, position, rotation, now, native, reposition)
    if not parent then return end
    local object = native.create(slot, model, native.offset(parent, position), now)
    if not object then return end
    if reposition or not IsEntityAttachedToEntity(object, parent) then native.attach(object, parent, position, rotation) end
    if IsEntityAttachedToEntity(object, parent) then return object end
    SetEntityVisible(object, false, false)
    slot.visible = false
end

function M.draw(state, part, now, native, phase)
    local cache = state.parts[part.id]
    if not cache then
        cache = { part = part, body = {}, moving = {}, lenses = {} }
        state.parts[part.id] = cache
    end
    local body = clip(cache.body, state.vehicle, part.model, part.position, part.rotation, now, native)
    if body and cache.body.visible == false then SetEntityVisible(body, true, false); cache.body.visible = true end
    local fraction = M.position(part, now)
    local angle = 88 * fraction
    local moving = clip(cache.moving, body, part.movingModel, part.pivot, { x = angle, y = 0.0, z = 0.0 },
        now, native, angle ~= cache.angle)
    if moving then
        cache.angle = angle
        if cache.moving.visible == false then SetEntityVisible(moving, true, false); cache.moving.visible = true end
    elseif native.valid(cache.moving) then
        SetEntityVisible(cache.moving.object, false, false)
        cache.moving.visible = false
    end
    local open = fraction >= 1 and part.pose.target == 1
    local desired = {}
    for _, optic in ipairs(part.optics) do
        local parent = body
        if optic.group == 'volet' then parent = moving end
        local color = parent and colorFor(part, optic, open, phase)
        local tint = color and optic.palette[color]
        if tint then desired[tint.model] = { tint = tint, parent = parent, projection = optic.projection } end
    end
    for model, slot in pairs(cache.lenses) do
        if not desired[model] then
            native.release(slot)
            if native.valid(slot) then native.lens(slot, slot.object, 0) end
        end
    end
    for model, wanted in pairs(desired) do
        local slot = cache.lenses[model] or { initiallyHidden = true }
        cache.lenses[model] = slot
        local valid = native.valid(slot)
        if valid or (state.opticsAllocationBudget > 0 and (not slot.retry or now >= slot.retry)) then
            if not valid then state.opticsAllocationBudget = state.opticsAllocationBudget - 1 end
            local lens = clip(slot, wanted.parent, model, zero, zero, now, native)
            if lens and native.lens(slot, lens, 100) then
                native.diffusion(wanted.projection, wanted.tint.rgb, wanted.parent, 100)
            end
        end
    end
end

function M.remove(cache, discard)
    local done = true
    for _, slot in pairs(cache.lenses) do if not discard(slot) then done = false end end
    if not discard(cache.moving) then done = false end
    if not discard(cache.body) then done = false end
    return done
end

Dev01 = Dev01 or {}
Dev01.SadlerRamp = M
