local openMenu

local function stamp()
    local ped = PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    if vehicle == 0 or GetPedInVehicleSeat(vehicle, -1) ~= ped then return end
    local value = Entity(vehicle).state.celkMountStamp
    return type(value) == 'string' and value or nil
end

local function close()
    openMenu = nil
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'close' })
end

local function epoch()
    return GetNetworkTimeAccurate() % 4294967296
end

RegisterCommand('celk_lights', function()
    local current = stamp()
    if current and not openMenu then TriggerServerEvent('celk:operate', current, 'lights', '', epoch()) end
end, false)

RegisterCommand('celk_scenes', function()
    if stamp() then TriggerServerEvent('celk:request', 'scenes') end
end, false)

RegisterCommand('celk_variants', function()
    if stamp() then TriggerServerEvent('celk:request', 'variants') end
end, false)

RegisterKeyMapping('celk_lights', 'CELK · Éclats', 'keyboard', 'Q')
RegisterKeyMapping('celk_scenes', 'CELK · Scènes', 'keyboard', 'J')
RegisterKeyMapping('celk_variants', 'CELK · Montages', 'keyboard', 'F6')

RegisterNetEvent('celk:options', function(payload)
    local current = stamp()
    if source ~= 65535 or type(payload) ~= 'table' or
        not current or (payload.pane ~= 'variants' and payload.pane ~= 'scenes') or payload.stamp ~= current then return end
    openMenu = { pane = payload.pane, stamp = payload.stamp }
    SetNuiFocus(true, true)
    SendNUIMessage({ type = 'open', options = payload })
end)

RegisterNetEvent('celk:message', function(message)
    if source ~= 65535 or type(message) ~= 'string' or #message > 500 then return end
    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName(message)
    EndTextCommandThefeedPostTicker(false, false)
end)

RegisterNUICallback('close', function(_, callback)
    close()
    callback({ ok = true })
end)

RegisterNUICallback('select', function(data, callback)
    if openMenu and openMenu.stamp == stamp() and type(data) == 'table' and type(data.id) == 'string' and #data.id <= 100 then
        TriggerServerEvent('celk:operate', openMenu.stamp, openMenu.pane == 'variants' and 'variant' or 'scene', data.id, epoch())
    end
    close()
    callback({ ok = true })
end)

CreateThread(function()
    while true do
        if openMenu and openMenu.stamp ~= stamp() then close() end
        Wait(openMenu and 200 or 1000)
    end
end)

CreateThread(function()
    while not NetworkIsSessionStarted() do Wait(250) end
    -- Resync viewers joining after a mount was applied, or after a bucket change.
    while true do
        TriggerServerEvent('celk:request', 'state')
        Wait(8000)
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() and openMenu then close() end
end)
