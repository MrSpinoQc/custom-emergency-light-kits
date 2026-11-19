local menu = {}
local opened, pending
local sequence = 0
local responseTimeout = 3000

function menu.stamp()
    local ped = PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    if vehicle == 0 or GetPedInVehicleSeat(vehicle, -1) ~= ped then return end
    local value = Entity(vehicle).state.celkMountStamp
    return type(value) == 'string' and value or nil
end

function menu.epoch()
    return GetNetworkTimeAccurate() % 4294967296
end

function menu.isOpen()
    return opened ~= nil
end

local function notify(message)
    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName(message)
    EndTextCommandThefeedPostTicker(false, false)
end

local function releaseProvider(view)
    local provider = view.provider
    view.provider = nil
    if GetResourceState(provider) == 'started' then
        pcall(function() exports[provider]:HideCELKMenu(view.session) end)
    end
end

local function close()
    local view = opened
    opened, pending = nil, nil
    if not view then return end
    if view.provider then
        releaseProvider(view)
    else
        SetNuiFocusKeepInput(false)
        SetNuiFocus(false, false)
        SendNUIMessage({ type = 'close' })
    end
end

local function request(pane, stamp)
    sequence = sequence % 0x7fffffff + 1
    local waiting = { pane = pane, stamp = stamp, id = sequence }
    pending = waiting
    SetTimeout(responseTimeout, function()
        if pending ~= waiting then return end
        close()
        notify('Le serveur ne répond pas. Rouvre le panneau pour vérifier les commandes.')
    end)
    return waiting.id
end

function menu.request(pane)
    if opened or pending then close(); return end
    local stamp = menu.stamp()
    if not stamp or IsPauseMenuActive() or IsNuiFocused() then return end
    TriggerServerEvent('celk:request', pane, request(pane, stamp))
end

local function configuredProvider()
    local name = GetConvar('celk_interface_provider', '')
    if name == GetCurrentResourceName() or #name > 64 or not name:match('^[%w_%-]+$')
        or GetResourceState(name) ~= 'started' or GetResourceMetadata(name, 'celk_interface_api', 0) ~= '1' then
        return
    end
    return name
end

local function show(view, first)
    if first then view.provider = configuredProvider() end
    if view.provider then
        local payload = view.payload
        local public = {
            apiVersion = 1, pane = payload.pane, model = payload.model, mountLabel = payload.mountLabel,
            service = payload.service, selected = payload.selected, choices = payload.choices,
            rampControls = payload.rampControls, rampMotion = payload.rampMotion,
            projectors = payload.projectors, notice = payload.notice,
        }
        local ok, accepted = pcall(function() return exports[view.provider]:ShowCELKMenu(view.session, public) end)
        if opened ~= view or (ok and accepted == true) then return end
        releaseProvider(view)
    end
    if opened ~= view then return end
    SetNuiFocusKeepInput(false)
    SetNuiFocus(true, true)
    SendNUIMessage({ type = 'open', session = view.session, options = view.payload })
end

RegisterNetEvent('celk:options', function(payload)
    local waiting = pending
    if source ~= 65535 or not waiting or type(payload) ~= 'table'
        or payload.requestId ~= waiting.id or payload.pane ~= waiting.pane then return end
    local stamp = menu.stamp()
    if stamp ~= waiting.stamp or IsPauseMenuActive() then close(); return end
    if type(payload.error) == 'string' then close(); notify(payload.error); return end
    if payload.stamp ~= stamp or type(payload.choices) ~= 'table' then close(); return end
    local first = opened == nil
    if first and IsNuiFocused() then close(); return end
    pending = nil
    opened = opened or { session = waiting.id, stamp = stamp }
    opened.payload = payload
    show(opened, first)
end)

local function authorised(session, caller)
    return opened and opened.session == session and opened.provider == caller
        and (not caller or GetResourceState(caller) == 'started')
end

local function submit(session, action, id, caller)
    if not authorised(session, caller) or pending or opened.stamp ~= menu.stamp()
        or IsPauseMenuActive() or type(id) ~= 'string' or #id > 100 then return false end
    local view = opened
    local pane = view.payload.pane
    local items
    if action == (pane == 'variants' and 'variant' or 'scene') then
        items = view.payload.choices
    elseif pane == 'scenes' and action == 'projector' then
        items = view.payload.projectors
    elseif pane == 'scenes' and action == 'sadler' then
        items = view.payload.rampControls
    end
    local offered = false
    for _, item in ipairs(items or {}) do
        if item.id == id then offered = true; break end
    end
    if not offered then return false end
    if action == 'sadler' then
        local response = request(pane, view.stamp)
        TriggerServerEvent('celk:operate', view.stamp, action, id, menu.epoch(), response)
    else
        close()
        TriggerServerEvent('celk:operate', view.stamp, action, id, menu.epoch())
    end
    return true
end

local function dismiss(session, caller)
    if not authorised(session, caller) then return false end
    close()
    return true
end

exports('SubmitCELKMenuAction', function(session, action, id)
    local caller = GetInvokingResource()
    return caller ~= nil and submit(session, action, id, caller)
end)

exports('DismissCELKMenu', function(session)
    local caller = GetInvokingResource()
    return caller ~= nil and dismiss(session, caller)
end)

RegisterNUICallback('action', function(data, callback)
    callback({ ok = type(data) == 'table' and submit(data.session, data.action, data.id) })
end)

RegisterNUICallback('close', function(data, callback)
    callback({ ok = type(data) == 'table' and dismiss(data.session) })
end)

CreateThread(function()
    while true do
        local view = opened or pending
        if view and (view.stamp ~= menu.stamp() or IsPauseMenuActive()) then close() end
        Wait(view and 200 or 1000)
    end
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        close()
    elseif opened and opened.provider == resource then
        opened.provider = nil
        if opened.stamp == menu.stamp() and not IsPauseMenuActive() then show(opened, false) else close() end
    end
end)

Dev01 = Dev01 or {}
Dev01.VehicleMenu = menu
