local M = {}
local zero = { x = 0, y = 0, z = 0 }
local doors = { door_dside_f = 0, door_pside_f = 1 }
local renderer = 'hellfire-optics-v06'
M.renderer = renderer

local function validEye(eye, model, group, v)
    if type(eye) ~= 'table' or eye.group ~= group or not v.asset(eye.model) or
        eye.model:sub(1, #model + 1) ~= model .. '_' or not v.triple(eye.origin, 6) or not v.triple(eye.axis, 1.00001) or
        not v.bounded(eye.range, 0, 100) or not v.bounded(eye.angle, 0, 179.8) or
        not v.bounded(eye.power, 0, 20) or not v.bounded(eye.falloff, 0, 100) or
        (eye.enabled ~= nil and type(eye.enabled) ~= 'boolean') or
        (eye.sourceEnabled ~= nil and type(eye.sourceEnabled) ~= 'boolean') then return false end
    local native = eye.nativeProjection
    if native ~= nil and (type(native) ~= 'table' or native.engineProfile ~= 'centre-mono-v2' or
        type(native.whenInherited) ~= 'boolean' or
        not v.bounded(native.range, 0, 150) or not v.bounded(native.power, 0, 20) or
        not v.bounded(native.hardness, 0, 1) or not v.bounded(native.size, 0, 1200) or
        not v.bounded(native.falloff, 0, 110)) then return false end
    local axis, color = eye.axis, eye.color
    return math.abs(math.sqrt(axis[1]^2 + axis[2]^2 + axis[3]^2) - 1) <= .00001 and type(color) == 'table'
        and v.integer(color.r, 0, 255) and v.integer(color.g, 0, 255) and v.integer(color.b, 0, 255)
end

local function validProjector(row, model, v)
    return type(row) == 'table' and type(row.on) == 'boolean' and row.fork == model .. '_lacet' and
        row.head == model .. '_tete' and v.vec(row.yawPivot, 1) and v.vec(row.pitchPivot, 1) and
        v.bounded(row.yawMin, -180, 180) and v.bounded(row.yawMax, row.yawMin, 180) and
        v.bounded(row.pitchMin, -90, 90) and v.bounded(row.pitchMax, row.pitchMin, 90) and
        v.bounded(row.yaw, row.yawMin, row.yawMax) and v.bounded(row.pitch, row.pitchMin, row.pitchMax) and
        validEye(row.eye, model, 'group:1', v) and row.eye.nativeProjection == nil
end

function M.validate(row, v)
    if not v.asset(row.model) or not row.model:match('^ta01_gh4v[678]_%d%d[gd]?$') or not v.key(row.id) or
        not v.vec(row.position, 6) or not v.vec(row.rotation, 180) or not v.dense(row.eyes, 0, 18) or
        (row.door ~= nil and not doors[row.door]) then return end
    local registry, overlays = {}, {}
    for i, eye in ipairs(row.eyes) do
        local group = 'group:' .. i
        if not validEye(eye, row.model, group, v) or overlays[eye.model] then return end
        overlays[eye.model], registry[group] = true, true
    end
    if row.projector ~= nil then
        if not row.model:match('^ta01_gh4v6_1[23]$') or #row.eyes > 0 or row.steps ~= nil or row.door ~= nil or
            not validProjector(row.projector, row.model, v) then return end
    elseif #row.eyes == 0 then return end
    local period = 0
    if row.steps ~= nil then
        if not v.dense(row.steps, 1, 512) then return end
        for _, step in ipairs(row.steps) do
            if type(step) ~= 'table' or not v.integer(step.duration, 1, 300000) or not v.dense(step.levels, #row.eyes, #row.eyes) then return end
            for _, level in ipairs(step.levels) do if not v.bounded(level, 0, 100) then return end end
            period = period + step.duration
        end
        if period > 300000 then return end
    end
    return { id = row.id, model = row.model, kind = renderer, position = row.position, rotation = row.rotation,
        eyes = row.eyes, projector = row.projector, steps = row.steps, period = period, door = row.door,
        registry = registry }
end

local function anglesMatrix(angles)
    local x, y, z = math.rad(angles.x), math.rad(angles.y), math.rad(angles.z)
    local a, b, c = math.cos(x), math.cos(y), math.cos(z)
    local d, e, f = math.sin(x), math.sin(y), math.sin(z)
    return {{c*b-f*d*e,-f*a,c*e+f*d*b}, {f*b+c*d*e,c*a,f*e-c*d*b}, {-a*e,d,a*b}}
end

local function validVector(v)
    return v and type(v.x) == 'number' and math.abs(v.x) < math.huge and
        type(v.y) == 'number' and math.abs(v.y) < math.huge and type(v.z) == 'number' and math.abs(v.z) < math.huge
end

local function mountPose(vehicle, part)
    if not part.door then return part.position, part.rotation, -1 end
    if type(GetEntityBoneRotationLocal) ~= 'function' or GetVehicleDoorAngleRatio(vehicle, doors[part.door]) > .03 then return end
    local bone = GetEntityBoneIndexByName(vehicle, part.door)
    if bone < 0 then return end
    local point = GetWorldPositionOfEntityBone(vehicle, bone)
    if not validVector(point) then return end
    local pointLocal = GetOffsetFromEntityGivenWorldCoords(vehicle, point.x, point.y, point.z)
    local angles = GetEntityBoneRotationLocal(vehicle, bone)
    if not validVector(pointLocal) or not validVector(angles) then return end
    local anchor, partMatrix = anglesMatrix(angles), anglesMatrix(part.rotation)
    local diff = { part.position.x - pointLocal.x, part.position.y - pointLocal.y, part.position.z - pointLocal.z }
    local p, relative = {}, {}
    for i = 1, 3 do
        p[i] = anchor[1][i]*diff[1] + anchor[2][i]*diff[2] + anchor[3][i]*diff[3]
        relative[i] = {}
        for j = 1, 3 do
            relative[i][j] = anchor[1][i]*partMatrix[1][j] + anchor[2][i]*partMatrix[2][j] + anchor[3][i]*partMatrix[3][j]
        end
    end
    local pitch = math.asin(math.min(1, math.max(-1, relative[3][2])))
    return { x = p[1], y = p[2], z = p[3] }, {
        x = math.deg(pitch), y = math.deg(math.atan(-relative[3][1], relative[3][3])),
        z = math.deg(math.atan(-relative[1][2], relative[2][2])),
    }, bone
end

local function put(slot, parent, model, position, rotation, bone, angle, now, ops)
    local object = ops.create(slot, model, ops.offset(parent, zero), now)
    if not object then return end
    if not IsEntityAttachedToEntity(object, parent) or slot.angle ~= angle then
        ops.attach(object, parent, position, rotation, bone)
        slot.angle = angle
    end
    if IsEntityAttachedToEntity(object, parent) then
        if slot.attachHidden then
            SetEntityVisible(object, true, false)
            slot.attachHidden, slot.visible = nil, nil
        end
        return object
    end
    SetEntityVisible(object, false, false)
    slot.attachHidden = true
end

local function drawEye(cache, parent, eye, level, project, now, ops)
    local slot = cache.overlays[eye.group]
    if not slot then
        if level <= 0 then return end
        slot = {}
        cache.overlays[eye.group] = slot
    end
    if level <= 0 and not slot.object then ops.discard(slot); return end
    local mesh = put(slot, parent, eye.model, zero, zero, -1, 0, now, ops)
    if not mesh or not ops.lens(slot, mesh, level) then return end
    local enabled = project == true or eye.enabled ~= false
    if eye.sourceEnabled ~= nil then enabled = eye.sourceEnabled and enabled end
    if project == false or not enabled or eye.range <= 0 or eye.power <= 0 or eye.angle <= 0 then return end
    local p, axis = eye.origin, eye.axis
    local a = ops.offset(parent, { x = p[1], y = p[2], z = p[3] })
    local b = ops.offset(parent, { x = p[1]+axis[1], y = p[2]+axis[2], z = p[3]+axis[3] })
    local x, y, z = b.x - a.x, b.y - a.y, b.z - a.z
    local length = math.sqrt(x*x+y*y+z*z)
    if length > .001 then
        local c = eye.color
        local native = eye.nativeProjection
        if native and not native.whenInherited and project ~= true then native = nil end
        DrawSpotLight(a.x, a.y, a.z, x/length, y/length, z/length, c.r, c.g, c.b,
            native and native.range or eye.range + 0.0, (native and native.power or eye.power) * level / 100,
            native and native.hardness or 0.0,
            native and native.size or eye.range * math.tan(math.rad(eye.angle / 2)),
            native and native.falloff or eye.falloff + 0.0)
    end
end

local function drawProjector(cache, body, projector, now, ops)
    local yaw, pitch = projector.yaw, projector.pitch
    local fork = put(cache.fork, body, projector.fork, projector.yawPivot, { x = 0, y = 0, z = yaw }, -1, yaw, now, ops)
    if not fork then return end
    local head = put(cache.head, fork, projector.head, projector.pitchPivot, { x = pitch, y = 0, z = 0 }, -1, pitch, now, ops)
    if head then drawEye(cache, head, projector.eye, projector.on and 100 or 0, true, now, ops) end
end

local function activeLevels(part, elapsed)
    if not elapsed or not part.steps then return end
    local remaining = elapsed % part.period
    for _, step in ipairs(part.steps) do
        if remaining < step.duration then return step.levels end
        remaining = remaining - step.duration
    end
end

function M.draw(state, part, compiled, elapsed, now, ops, sample)
    local cache = state.parts[part.id]
    if not cache then
        cache = { part = part, body = {}, overlays = {}, fork = {}, head = {} }
        state.parts[part.id] = cache
    end
    local body = cache.body.object
    if not ops.valid(cache.body) or not IsEntityAttachedToEntity(body, state.vehicle) then
        local position, rotation, bone = mountPose(state.vehicle, part)
        if not position then return end
        body = put(cache.body, state.vehicle, part.model, position, rotation, bone, 0, now, ops)
        if not body then return end
    end
    if part.projector then
        drawProjector(cache, body, part.projector, now, ops)
        return
    end
    local levels = activeLevels(part, elapsed)
    for i, eye in ipairs(part.eyes) do
        local level, projection
        if elapsed then level, projection = sample(compiled, part.id, eye.group, elapsed, true) end
        drawEye(cache, body, eye, level or (levels and levels[i]) or 0, projection, now, ops)
    end
end

function M.remove(cache, discard)
    local done = true
    for _, slot in pairs(cache.overlays) do if not discard(slot) then done = false end end
    return done and discard(cache.head) and discard(cache.fork) and discard(cache.body)
end

Dev01 = Dev01 or {}
Dev01.HellfireV06 = M
