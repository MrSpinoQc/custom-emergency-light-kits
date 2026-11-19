local M = { renderer = 'airport-bus-optics-v1' }
local opticsByModel = {
    ta01_ab_flat_f = 6, ta01_ab_flat_r = 6,
    ta01_ab_hex_r = 3, ta01_ab_hex_b = 3, ta01_ab_chev_l = 3, ta01_ab_chev_r = 3,
    ta01_ab_upper_l = 3, ta01_ab_upper_r = 3, ta01_ab_lower = 3, ta01_ab_scene = 1,
}

function M.validate(raw, v)
    local number = type(raw.id) == 'string' and raw.id:match('^bus%-v01%-(%d%d)$')
    local count = opticsByModel[raw.model]
    if not number or tonumber(number) < 1 or tonumber(number) > 20 or raw.sourceKey ~= 'BUS-V01-' .. number
        or not count or not v.vec(raw.position, 12) or math.abs(raw.position.x) > 4 or math.abs(raw.position.z) > 5
        or not v.vec(raw.rotation, 180) or not v.dense(raw.optics, count, count) then return end
    local projecteur = raw.model == 'ta01_ab_scene'
    if projecteur then
        local p = raw.projector
        if type(p) ~= 'table' or type(p.on) ~= 'boolean' or p.yaw ~= 0 or p.pitch ~= 0
            or p.yawMin ~= 0 or p.yawMax ~= 0 or p.pitchMin ~= 0 or p.pitchMax ~= 0 then return end
    elseif raw.projector ~= nil then return end

    local original = raw.original
    if original ~= nil then
        if projecteur or type(original) ~= 'table' or not v.dense(original.steps, 1, 32) then return end
        local period = 0
        for _, step in ipairs(original.steps) do
            if type(step) ~= 'table' or not v.integer(step.duration, 40, 5000) or not v.dense(step.levels, count, count) then return end
            for _, value in ipairs(step.levels) do if not v.bounded(value, 0, 100) then return end end
            period = period + step.duration
        end
        if period > 30000 or period ~= original.period then return end
    end

    local optics, registry, models, geometry, diagnostics = {}, {}, {}, { raw.model }, {}
    for _, source in ipairs(raw.optics) do
        if type(source) ~= 'table' or not v.asset(source.model) or source.model:sub(1, #raw.model + 1) ~= raw.model .. '_'
            or type(source.id) ~= 'string' or not source.id:match('^group:[1-6]$') or models[source.model]
            or not v.dense(source.rgb, 3, 3) then return end
        for _, color in ipairs(source.rgb) do if not v.integer(color, 0, 255) then return end end
        if source.diffusion ~= nil and not v.validDiffusion(source.diffusion) then return end
        if registry[source.id] then return end
        registry[source.id], models[source.model] = true, true
        optics[#optics + 1] = { id = source.id, base = 'fixe', variants = { fixe = source.model },
            color = { r = source.rgb[1], g = source.rgb[2], b = source.rgb[3] }, diffusion = source.diffusion }
        geometry[#geometry + 1] = source.id .. ':' .. source.model
        diagnostics[source.model] = raw.sourceKey .. '/' .. source.id
    end
    return { id = raw.id, model = raw.model, kind = M.renderer, position = raw.position, rotation = raw.rotation,
        optics = optics, registry = projecteur and {} or registry, geometry = table.concat(geometry, '|'),
        projector = raw.projector, diagnostics = diagnostics, original = original }
end

Dev01 = Dev01 or {}
Dev01.AirportBusV05 = M
