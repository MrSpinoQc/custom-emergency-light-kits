local permission = 'celk.admin.packs'
local last = {}

local function allowed(player)
    return type(player) == 'number' and player > 0 and IsPlayerAceAllowed(tostring(player), permission)
end

AddEventHandler('playerDropped', function()
    local player = tonumber(source)
    if player then last[player] = nil end
end)

RegisterNetEvent('celk_admin:request', function(action, payload, requestId)
    local player = tonumber(source)
    if requestId ~= nil and (type(requestId) ~= 'number' or requestId % 1 ~= 0
        or requestId < 1 or requestId > 2147483647) then return end
    if not allowed(player) then
        if player and player > 0 then
            TriggerClientEvent('celk_admin:result', player, { error = 'Droit administrateur CELK requis.', requestId = requestId })
        end
        return
    end
    local now = GetGameTimer()
    if last[player] and now - last[player] < 500 then return end
    last[player] = now
    if action ~= 'catalog' and action ~= 'save' then return end
    if action == 'save' and (type(payload) ~= 'string' or #payload > 16384) then return end

    local port = GetConvarInt('celk_admin_port', 0)
    local key = GetConvar('celk_admin_key', '')
    local function reply(result)
        result.requestId = requestId
        if allowed(player) then TriggerClientEvent('celk_admin:result', player, result) end
    end
    if port < 1 or port > 65535 or #key ~= 64 then
        return reply({ error = 'Le gestionnaire de dépôt est indisponible.' })
    end
    local base = ('http://127.0.0.1:%d'):format(port)
    local save = action == 'save'
    PerformHttpRequest(base .. (save and '/selection' or '/catalog'), function(status, body)
        if type(body) ~= 'string' or #body > 65536 then
            return reply({ error = 'Le gestionnaire de dépôt ne répond pas.' })
        end
        local ok, result = pcall(json.decode, body)
        if not ok or type(result) ~= 'table' then return reply({ error = 'Réponse du dépôt invalide.' }) end
        if status ~= 200 then return reply({ error = result.error or 'Action refusée.' }) end
        local ok, loaded = pcall(function() return json.decode(exports.celk_runtime:ReadActiveSelections()) end)
        local comparable = ok and type(loaded) == 'table' and type(result.bootSelections) == 'table'
        for _, row in ipairs(result.rows) do
            if not row.active then
                row.loaded = false
            elseif comparable and result.bootSelections[row.activeModel] then
                row.loaded = loaded[row.activeModel] == result.bootSelections[row.activeModel]
            end
        end
        result.bootSelections = nil
        if save then result.saved = true end
        reply(result)
    end, save and 'PUT' or 'GET', save and payload or '', {
        Authorization = 'Bearer ' .. key, ['Content-Type'] = 'application/json',
    }, { followLocation = false })
end)
