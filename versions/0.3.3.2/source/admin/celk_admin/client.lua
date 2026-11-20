local open = false
local sequence, pending = 0, nil
local function close()
    open, pending = false, nil
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
    SendNUIMessage({ kind = 'close' })
end

local function request(action, payload)
    if pending then return false end
    sequence = sequence % 0x7fffffff + 1
    local id = sequence
    pending = id
    TriggerServerEvent('celk_admin:request', action, payload or '', id)
    SetTimeout(4500, function()
        if pending ~= id then return end
        pending = nil
        if open then
            SendNUIMessage({ kind = 'catalog', payload = { error = 'Réponse indisponible. Actualise pour reprendre.' } })
        end
    end)
    return true
end

RegisterCommand('celk_admin', function()
    if IsPauseMenuActive() or IsNuiFocused() then return end
    request('catalog')
end, false)
if GetConvarInt('celk_admin_owns_f10', 1) == 1 then
    RegisterKeyMapping('celk_admin', 'CELK · Administration', 'keyboard', 'F10')
end

RegisterNetEvent('celk_admin:result', function(payload)
    if source ~= 65535 or type(payload) ~= 'table' or not pending or payload.requestId ~= pending then return end
    pending = nil
    if payload.error and not open then
        BeginTextCommandThefeedPost('STRING')
        AddTextComponentSubstringPlayerName(payload.error)
        EndTextCommandThefeedPostTicker(false, false)
        return
    end
    if not open then
        if IsPauseMenuActive() or IsNuiFocused() then return end
        open = true
        SetNuiFocusKeepInput(false)
        SetNuiFocus(true, true)
    end
    SendNUIMessage({ kind = 'catalog', payload = payload })
end)

RegisterNUICallback('close', function(_, done) close(); done({ ok = true }) end)
RegisterNUICallback('refresh', function(_, done)
    done({ ok = open and request('catalog') })
end)
RegisterNUICallback('save', function(data, done)
    done({ ok = open and type(data) == 'table' and request('save', json.encode(data)) })
end)
AddEventHandler('onClientResourceStop', function(resource)
    if resource == GetCurrentResourceName() and open then close() end
end)
