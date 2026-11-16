local resource = GetCurrentResourceName()
local limit = assert(json.decode(LoadResourceFile(resource, 'installation-limits.json')).maxAccessoriesPerVehicle)
local timeline = assert(Dev01.LightTimeline)
local uint = 4294967296
local origin = { x = 0.0, y = 0.0, z = 0.0 }
local legacyColors = {
    red = { r = 255, g = 12, b = 9, id = 'rouge' },
    blue = { r = 24, g = 72, b = 255, id = 'bleu' },
}
local entries, visuals, requests = {}, {}, {}

local function bounded(n, min, max)
    return type(n) == 'number' and n >= min and n <= max
end

local function integer(n, min, max)
    return bounded(n, min, max) and n % 1 == 0
end

local function dense(value, min, max)
    if type(value) ~= 'table' or #value < min or #value > max then return false end
    local count = 0
    for key in pairs(value) do
        if not integer(key, 1, #value) then return false end
        count = count + 1
    end
    return count == #value
end

local function key(value)
    return type(value) == 'string' and #value <= 64 and value:match('^[a-z0-9][a-z0-9_.%-]*$') ~= nil
end

local function asset(value)
    return type(value) == 'string' and #value <= 63
        and (value:match('^ta01_[a-z0-9][a-z0-9_]*$') or value:match('^celk_[a-z0-9][a-z0-9_]*$'))
end

local function vec(value, limit)
    return type(value) == 'table' and bounded(value.x, -limit, limit) and bounded(value.y, -limit, limit)
        and bounded(value.z, -limit, limit)
end

local function triple(value, limit)
    return dense(value, 3, 3) and bounded(value[1], -limit, limit) and bounded(value[2], -limit, limit)
        and bounded(value[3], -limit, limit)
end

local function sameTriple(a, b)
    return math.abs(a[1] - b[1]) <= .000001 and math.abs(a[2] - b[2]) <= .000001
        and math.abs(a[3] - b[3]) <= .000001
end

local function validNativeProjection(optic)
    local compiled = optic.nativeProjection
    if type(compiled) ~= 'table' or compiled.version ~= 1 or compiled.engineProfile ~= 'centre-mono-v2'
        or not dense(compiled.emitters, #optic.emitters, #optic.emitters) then return false end
    for index, call in ipairs(compiled.emitters) do
        local emitter = optic.emitters[index]
        if call ~= false and (type(call) ~= 'table'
            or not bounded(call.rangeM, .000001, 512) or not bounded(call.brightness, 0, 1000)
            or not bounded(call.hardness, 0, 1) or not bounded(call.nativeSizeArgument, 0, 100000)
            or not bounded(call.falloff, 0, 1000) or not bounded(call.halfAngleDeg, .000001, 89.9)
            or not triple(call.originLocalM, 6) or not triple(call.axisLocal, 1.00001)
            or not sameTriple(call.originLocalM, emitter.origin) or not sameTriple(call.axisLocal, emitter.axis)) then
            return false
        end
    end
    return true
end

local function validOptics(optics)
    if optics == nil then return true end
    if type(optics) ~= 'table' then return false end
    for id, optic in pairs(optics) do
        if id ~= 'group:1' or type(optic) ~= 'table' or type(optic.enabled) ~= 'boolean'
            or not bounded(optic.rangeM, 0, 60) or not bounded(optic.openingDeg, 1, 180)
            or not bounded(optic.intensity, 0, 20) or not bounded(optic.falloff, 0, 100)
            or not dense(optic.emitters, 0, 16) then return false end
        for _, emitter in ipairs(optic.emitters) do
            if type(emitter) ~= 'table' or not triple(emitter.origin, 6)
                or not triple(emitter.axis, 1.00001) then return false end
            local axis = emitter.axis
            if math.abs(math.sqrt(axis[1]^2 + axis[2]^2 + axis[3]^2) - 1) > .00001 then return false end
        end
        if not validNativeProjection(optic) then return false end
    end
    return true
end

local function validatePart(part)
    if type(part) ~= 'table' or not key(part.id) or not asset(part.model) or part.kind ~= 'prop'
        or not vec(part.position, 6) or not vec(part.rotation, 180)
        or part.bone ~= nil or part.emissive ~= nil or part.stageLights ~= nil or part.housingModel ~= nil
        or part.beam ~= nil or part.pattern ~= nil or part.group ~= nil
        or not dense(part.zones, 1, 1) or not dense(part.ghostSteps, 1, 32) or not validOptics(part.optics) then return end
    local zone = part.zones[1]
    if type(zone) ~= 'table' or zone.id ~= 'centre' or not asset(zone.model) or zone.model == part.model
        or type(zone.color) ~= 'table' then return end
    local r, g, b, id = zone.color.r, zone.color.g, zone.color.b, zone.color.id
    if id == nil then
        local suffix = zone.model:match('_([a-z]+)$')
        local legacy = suffix and legacyColors[suffix]
        if not legacy or zone.model ~= part.model .. '_' .. suffix
            or r ~= legacy.r or g ~= legacy.g or b ~= legacy.b then return end
        id = legacy.id
    elseif type(id) ~= 'string' or #id > 32 or not id:match('^[a-z][a-z0-9%-]*$')
        or not integer(r, 0, 255) or not integer(g, 0, 255) or not integer(b, 0, 255) then return end
    local rgb = { r = r, g = g, b = b, id = id }
    local period = 0
    for _, step in ipairs(part.ghostSteps) do
        if type(step) ~= 'table' or not integer(step.duration, 40, 5000)
            or not dense(step.levels, 1, 1) or not bounded(step.levels[1], 0, 100) then return end
        period = period + step.duration
    end
    if period > 30000 then return end
    return {
        id = part.id, model = part.model, lens = zone.model, color = rgb,
        position = part.position, rotation = part.rotation, steps = part.ghostSteps, period = period,
        optic = part.optics and part.optics['group:1'],
    }
end

local function validateEntry(row)
    if type(row) ~= 'table' or not integer(row.netId, 1, 65535) or not integer(row.modelHash, 1, uint - 1)
        or type(row.stamp) ~= 'string' or #row.stamp > 96 or not row.stamp:match('^[%w_.:%-]+$')
        or type(row.lights) ~= 'boolean' or (row.lights and not integer(row.epoch, 0, uint - 1))
        or (row.epoch ~= nil and not integer(row.epoch, 0, uint - 1)) or not dense(row.parts, 0, limit) then return end
    local parts, registry, palette = {}, {}, {}
    for _, raw in ipairs(row.parts) do
        local part = validatePart(raw)
        if not part or parts[part.id] then return end
        parts[part.id] = part
        registry[part.id] = { ['group:1'] = true }
        palette[part.id] = { ['group:1'] = { [part.color.id] = true } }
    end
    local compiled
    if row.timeline ~= nil then
        compiled = timeline.compile(row.timeline, registry, palette)
        if not compiled then return end
    end
    return { stamp = row.stamp, modelHash = row.modelHash, lights = row.lights, epoch = row.epoch, parts = parts, timeline = compiled }
end

RegisterNetEvent('celk:state', function(payload)
    if source ~= 65535 or type(payload) ~= 'table' or payload.version ~= 1
        or not dense(payload.entries, 0, 1024) then return end
    local nextEntries, seen = {}, {}
    for _, row in ipairs(payload.entries) do
        if type(row) == 'table' and integer(row.netId, 1, 65535) then
            local netId = row.netId
            if seen[netId] then nextEntries[netId] = nil
            else nextEntries[netId] = validateEntry(row) end
            seen[netId] = true
        end
    end
    entries = nextEntries
end)

local function release(slot)
    local hash = slot.request
    if not hash then return end
    slot.request = nil
    requests[hash] = requests[hash] - 1
    if requests[hash] == 0 then
        requests[hash] = nil
        SetModelAsNoLongerNeeded(hash)
    end
end

local function discard(slot)
    release(slot)
    local object = slot.object
    if object and DoesEntityExist(object) and GetEntityModel(object) % uint == slot.hash % uint then
        SetEntityVisible(object, false, false)
        DetachEntity(object, false, false)
        DeleteEntity(object)
        if DoesEntityExist(object) then return false end
    end
    slot.object = nil
    return true
end

local function removePart(state, id)
    local part = state.parts[id]
    local lensRemoved = discard(part.lens)
    local bodyRemoved = discard(part.body)
    if lensRemoved and bodyRemoved then
        state.parts[id] = nil
        return true
    end
    return false
end

local function cleanup(netId)
    local state = visuals[netId]
    if not state then return true end
    for id in pairs(state.parts) do removePart(state, id) end
    if next(state.parts) then return false end
    visuals[netId] = nil
    return true
end

local function create(slot, model, point, now)
    if slot.object and DoesEntityExist(slot.object) and GetEntityModel(slot.object) % uint == slot.hash % uint then
        return slot.object
    end
    slot.object = nil
    if slot.retry and now < slot.retry then return end
    local hash = slot.hash or GetHashKey(model)
    slot.hash = hash
    if not slot.request then
        if not IsModelInCdimage(hash) or not IsModelValid(hash) or IsModelAVehicle(hash) or IsModelAPed(hash) then
            slot.retry = now + 1500
            return
        end
        if not requests[hash] then RequestModel(hash) end
        requests[hash] = (requests[hash] or 0) + 1
        slot.request, slot.requestedAt = hash, now
    end
    if not HasModelLoaded(hash) then
        if now - slot.requestedAt >= 4000 then
            release(slot)
            slot.retry = now + 1500
        end
        return
    end
    local object = CreateObjectNoOffset(hash, point.x, point.y, point.z, false, false, false)
    release(slot)
    if object == 0 or not DoesEntityExist(object) then
        slot.retry = now + 1500
        return
    end
    SetEntityAsMissionEntity(object, true, false)
    SetEntityCollision(object, false, false)
    SetEntityInvincible(object, true)
    slot.object, slot.visible, slot.alpha = object, nil, nil
    return object
end

local function offset(entity, position)
    return GetOffsetFromEntityInWorldCoords(entity, position.x + 0.0, position.y + 0.0, position.z + 0.0)
end

local function attach(object, target, position, rotation)
    AttachEntityToEntity(object, target, -1, position.x + 0.0, position.y + 0.0, position.z + 0.0,
        rotation.x + 0.0, rotation.y + 0.0, rotation.z + 0.0, false, false, false, false, 2, true)
end

local function draw(part, body, level, projection)
    local optic = part.optic
    if not optic or projection == false or (projection ~= true and not optic.enabled)
        or optic.rangeM <= 0 or optic.intensity <= 0 then return end
    local rgb = part.color
    for _, call in ipairs(optic.nativeProjection.emitters) do
        if call ~= false and call.brightness > 0 then
            local point, axis = call.originLocalM, call.axisLocal
            local start = offset(body, { x = point[1], y = point[2], z = point[3] })
            local finish = offset(body, { x = point[1] + axis[1], y = point[2] + axis[2], z = point[3] + axis[3] })
            local dx, dy, dz = finish.x - start.x, finish.y - start.y, finish.z - start.z
            local length = math.sqrt(dx^2 + dy^2 + dz^2)
            if length > .001 then
                DrawSpotLight(start.x, start.y, start.z, dx / length, dy / length, dz / length, rgb.r, rgb.g, rgb.b,
                    call.rangeM + 0.0, call.brightness * level / 100, call.hardness + 0.0,
                    call.nativeSizeArgument + 0.0, call.falloff + 0.0)
            end
        end
    end
end

local function ghostLevel(part, elapsed)
    local remaining = elapsed % part.period
    for _, step in ipairs(part.steps) do
        if remaining < step.duration then return step.levels[1] end
        remaining = remaining - step.duration
    end
    return 0
end

local function drawPart(state, part, level, projection, now)
    local cache = state.parts[part.id]
    if not cache then
        cache = { part = part, body = {}, lens = {} }
        state.parts[part.id] = cache
    end
    local body = create(cache.body, part.model, offset(state.vehicle, part.position), now)
    if not body then return end
    if not IsEntityAttachedToEntity(body, state.vehicle) then attach(body, state.vehicle, part.position, part.rotation) end
    if not IsEntityAttachedToEntity(body, state.vehicle) then return end
    local lens = create(cache.lens, part.lens, offset(body, origin), now)
    if not lens then return end
    if not IsEntityAttachedToEntity(lens, body) then
        SetEntityVisible(lens, false, false)
        cache.lens.visible = false
        attach(lens, body, origin, origin)
    end
    if not IsEntityAttachedToEntity(lens, body) then return end
    local visible = level > 0
    if cache.lens.visible ~= visible then
        SetEntityVisible(lens, visible, false)
        cache.lens.visible = visible
    end
    if not visible then return end
    local alpha = 51 * math.max(1, math.floor(level / 20 + .5))
    if cache.lens.alpha ~= alpha then
        SetEntityAlpha(lens, alpha, false)
        cache.lens.alpha = alpha
    end
    draw(part, body, level, projection)
end

local function sameVec(a, b)
    return a.x == b.x and a.y == b.y and a.z == b.z
end

local function sameGeometry(old, part)
    return part and old.model == part.model and old.lens == part.lens
        and sameVec(old.position, part.position) and sameVec(old.rotation, part.rotation)
end

local function drawVehicle(netId, vehicle, entry, now, networkTime)
    local state = visuals[netId]
    if state and (state.vehicle ~= vehicle or state.stamp ~= entry.stamp) then
        if not cleanup(netId) then return end
        state = nil
    end
    if not state then
        state = { vehicle = vehicle, stamp = entry.stamp, parts = {} }
        visuals[netId] = state
    end
    local ready = true
    for id, mounted in pairs(state.parts) do
        if not sameGeometry(mounted.part, entry.parts[id]) and not removePart(state, id) then ready = false end
    end
    if not ready then return end
    local elapsed = entry.lights and timeline.elapsed(networkTime, entry.epoch)
    for id, part in pairs(entry.parts) do
        local level, projection
        if elapsed then
            level, projection = timeline.sample(entry.timeline, id, 'group:1', elapsed, true)
            if level == nil then level = ghostLevel(part, elapsed) end
        end
        drawPart(state, part, level or 0, projection, now)
    end
end

CreateThread(function()
    while true do
        local sleep = 200
        local playerPosition = GetEntityCoords(PlayerPedId())
        local now, networkTime = GetGameTimer(), GetNetworkTimeAccurate() % uint
        for netId in pairs(visuals) do
            if not entries[netId] then cleanup(netId) end
        end
        for netId, entry in pairs(entries) do
            local vehicle = NetworkDoesEntityExistWithNetworkId(netId) and NetToVeh(netId) or 0
            if vehicle ~= 0 and DoesEntityExist(vehicle) and IsEntityAVehicle(vehicle)
                and GetEntityModel(vehicle) % uint == entry.modelHash and Entity(vehicle).state.celkMountStamp == entry.stamp
                and #(GetEntityCoords(vehicle) - playerPosition) <= 150 then
                sleep = 0
                drawVehicle(netId, vehicle, entry, now, networkTime)
            else
                cleanup(netId)
            end
        end
        Wait(sleep)
    end
end)

AddEventHandler('onResourceStop', function(stopping)
    if stopping == resource then
        entries = {}
        for netId in pairs(visuals) do cleanup(netId) end
    end
end)
