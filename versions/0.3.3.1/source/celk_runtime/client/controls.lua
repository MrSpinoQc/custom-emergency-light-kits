local menu = Dev01.VehicleMenu
local stamp, epoch = menu.stamp, menu.epoch

local function requestLights(current, desired, provider)
    if desired == nil then
        TriggerServerEvent('celk:operate', current, provider == 'lvc' and 'lvcToggle' or 'lights', '', epoch())
    else
        TriggerServerEvent('celk:operate', current, 'lightsState', desired and '1' or '0', epoch())
    end
end

exports('SetLvcLights', function(vehicle, desired)
    if GetInvokingResource() ~= 'lvc' or GetConvarInt('celk_lvc_enabled', 1) ~= 1 then return false end
    if desired ~= nil and type(desired) ~= 'boolean' then return false end
    if GetVehiclePedIsIn(PlayerPedId(), false) ~= vehicle then return false end
    local current = stamp()
    if not current then return false end
    requestLights(current, desired, 'lvc')
    return true
end)

exports('ToggleLvcSiren', function(vehicle)
    if GetInvokingResource() ~= 'lvc' or GetConvarInt('celk_lvc_enabled', 1) ~= 1
        or GetVehiclePedIsIn(PlayerPedId(), false) ~= vehicle then return false end
    local current = stamp()
    if not current then return false end
    TriggerServerEvent('celk:operate', current, 'lvcSiren', '', epoch())
    return true
end)

RegisterCommand('celk_lights', function()
    local current = stamp()
    if not current or menu.isOpen() or IsPauseMenuActive() or IsNuiFocused() then return end
    if GetConvarInt('celk_lvc_enabled', 1) == 1 and GetResourceState('lvc') == 'started' then
        local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
        local ok, handled = pcall(function() return exports.lvc:HandleCELKQ(vehicle) end)
        if ok and handled == true then return end
    end
    requestLights(current, nil)
end, false)

RegisterCommand('celk_siren', function()
    local current = stamp()
    if not current or menu.isOpen() or IsPauseMenuActive() or IsNuiFocused() then return end
    if GetConvarInt('celk_lvc_enabled', 1) == 1 and GetResourceState('lvc') == 'started' then
        local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
        local ok, handled = pcall(function() return exports.lvc:HandleCELKAlt(vehicle) end)
        if ok and handled == true then return end
    end
    TriggerServerEvent('celk:operate', current, 'siren', '', epoch())
end, false)

RegisterCommand('celk_scenes', function()
    menu.request('scenes')
end, false)

RegisterCommand('celk_variants', function()
    menu.request('variants')
end, false)

RegisterKeyMapping('celk_lights', 'CELK · Éclats', 'keyboard', 'Q')
RegisterKeyMapping('celk_siren', 'CELK · Sirène', 'keyboard', 'LMENU')
RegisterKeyMapping('celk_scenes', 'CELK · Scènes', 'keyboard', 'J')
RegisterKeyMapping('celk_variants', 'CELK · Montages', 'keyboard', 'F6')

for direction, hotkey in pairs({ left = 'NUMPAD4', right = 'NUMPAD6', up = 'NUMPAD8', down = 'NUMPAD2' }) do
    local aim = direction
    local name = 'celk_aim_' .. aim
    RegisterCommand(name, function()
        local current = stamp()
        if current and not menu.isOpen() then TriggerServerEvent('celk:operate', current, 'aim', aim, epoch()) end
    end, false)
    RegisterKeyMapping(name, 'CELK · Visée du projecteur ' .. hotkey, 'keyboard', hotkey)
end

RegisterNetEvent('celk:message', function(message)
    if source ~= 65535 or type(message) ~= 'string' or #message > 500 then return end
    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName(message)
    EndTextCommandThefeedPostTicker(false, false)
end)

CreateThread(function()
    while not NetworkIsSessionStarted() do Wait(250) end
    -- Resync viewers joining after a mount was applied, or after a bucket change.
    while true do
        TriggerServerEvent('celk:request', 'state')
        Wait(8000)
    end
end)
