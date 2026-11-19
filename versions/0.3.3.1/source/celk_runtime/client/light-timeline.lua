local M = {}
local MAX_UINT = 4294967296

local function integer(n, low, high)
    return type(n) == 'number' and n >= low and n <= high and n % 1 == 0
end

local function fields(value, allowed)
    if type(value) ~= 'table' then return false end
    for key in pairs(value) do if not allowed[key] then return false end end
    return true
end

local function list(value, limit)
    if type(value) ~= 'table' or #value > limit then return false end
    local n = 0
    for key in pairs(value) do
        if not integer(key, 1, #value) then return false end
        n = n + 1
    end
    return n == #value
end

local timelineFields = { schema = true, version = true, durationMs = true, enabled = true, loop = true, tracks = true }
local trackFields = { pieceKey = true, opticId = true, clips = true }
local clipFields = { startMs = true, endMs = true, level = true, projection = true, colorId = true }

function M.compile(raw, registry, palettes)
    if not fields(raw, timelineFields) or raw.schema ~= 'tryagain.light-timeline' or (raw.version ~= 1 and raw.version ~= 2)
        or not integer(raw.durationMs, 1, 300000) or type(raw.enabled) ~= 'boolean'
        or type(raw.loop) ~= 'boolean' or not list(raw.tracks, 160) then return nil end
    local lookup, count = {}, 0
    for _, track in ipairs(raw.tracks) do
        if not fields(track, trackFields) or type(track.pieceKey) ~= 'string' or type(track.opticId) ~= 'string'
            or not registry[track.pieceKey] or registry[track.pieceKey][track.opticId] ~= true
            or not list(track.clips, 512) then return nil end
        local part = lookup[track.pieceKey] or {}
        if part[track.opticId] then return nil end
        lookup[track.pieceKey] = part
        count = count + #track.clips
        if count > 4096 then return nil end
        local clips = {}
        local palette = palettes and palettes[track.pieceKey] and palettes[track.pieceKey][track.opticId]
        for _, clip in ipairs(track.clips) do
            if not fields(clip, clipFields) or not integer(clip.startMs, 0, raw.durationMs - 1)
                or not integer(clip.endMs, clip.startMs + 1, raw.durationMs)
                or not integer(clip.level, 0, 100)
                or (clip.projection ~= nil and type(clip.projection) ~= 'boolean')
                or (clip.colorId ~= nil and (raw.version ~= 2 or type(clip.colorId) ~= 'string'
                    or not palette or not palette[clip.colorId])) then return nil end
            clips[#clips + 1] = { startMs = clip.startMs, endMs = clip.endMs, level = clip.level,
                projection = clip.projection, colorId = clip.colorId }
        end
        table.sort(clips, function(a, b) return a.startMs < b.startMs end)
        for i = 2, #clips do if clips[i - 1].endMs > clips[i].startMs then return nil end end
        part[track.opticId] = clips
    end
    return { durationMs = raw.durationMs, enabled = raw.enabled, loop = raw.loop, tracks = lookup }
end

function M.elapsed(now, epoch)
    if not integer(epoch, 0, MAX_UINT - 1) or not integer(now, -MAX_UINT, MAX_UINT - 1) then return nil end
    local elapsed = (now - epoch) % MAX_UINT
    -- A snapshot can arrive a frame before the client network clock reaches
    -- the reported Q tick. Do not mistake that lead for a 49-day session.
    return elapsed >= MAX_UINT / 2 and 0 or elapsed
end

function M.sample(compiled, pieceKey, opticId, elapsed, active)
    if not compiled or not compiled.enabled then return nil end
    local part = compiled.tracks[pieceKey]
    local clips = part and part[opticId]
    if not clips then return nil end
    if not active or not integer(elapsed, 0, MAX_UINT - 1) then return 0 end
    local t = compiled.loop and elapsed % compiled.durationMs or math.min(elapsed, compiled.durationMs - 1)
    local low, high = 1, #clips
    while low <= high do
        local mid = math.floor((low + high) / 2)
        local clip = clips[mid]
        if t < clip.startMs then high = mid - 1
        elseif t >= clip.endMs then low = mid + 1
        else return clip.level, clip.projection, clip.colorId end
    end
    return 0
end

Dev01 = Dev01 or {}
Dev01.LightTimeline = M
