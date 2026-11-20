local context = 'celk_vehicle_interface'
local opened

local function hide()
    opened = nil
    if lib.getOpenContextMenu() == context then lib.hideContext(false) end
end

exports('ShowCELKMenu', function(session, view)
    if GetInvokingResource() ~= 'celk_runtime' or view.apiVersion ~= 1 then return false end
    local options = {}
    local function add(item, action, description, disabled)
        options[#options + 1] = {
            title = item.label,
            description = description,
            disabled = disabled == true,
            onSelect = function()
                if opened ~= session then return end
                if not exports.celk_runtime:SubmitCELKMenuAction(session, action, item.id) then
                    exports.celk_runtime:DismissCELKMenu(session)
                end
            end,
        }
    end
    if view.notice then
        options[#options + 1] = { title = view.notice, readOnly = true }
    end
    for _, item in ipairs(view.choices) do
        local selected = item.id == view.selected
        local fitting = view.pane == 'variants'
        add(item, fitting and 'variant' or 'scene',
            selected and (fitting and 'Installé' or 'Sélectionnée') or nil, fitting and selected)
    end
    for _, item in ipairs(view.rampControls or {}) do
        if item.id ~= 'linkedCorners' and item.id ~= 'independentCorners'
            and not (item.on and (item.id == 'open' or item.id == 'close')) then
            add(item, 'sadler', item.on and 'Actif' or nil)
        end
    end
    for _, item in ipairs(view.projectors or {}) do
        local state = item.on and 'Allumé' or 'Éteint'
        if item.aimable then state = ('%s · %s° / %s°'):format(state, item.yaw, item.pitch) end
        add(item, 'projector', state)
    end
    if #options == 0 then return false end
    opened = session
    lib.registerContext({
        id = context,
        title = view.pane == 'variants' and 'Montages CELK' or (view.mountLabel or 'Scènes CELK'),
        onExit = function()
            if opened ~= session then return end
            opened = nil
            exports.celk_runtime:DismissCELKMenu(session)
        end,
        options = options,
    })
    lib.showContext(context)
    return true
end)

exports('HideCELKMenu', function(session)
    if GetInvokingResource() == 'celk_runtime' and opened == session then hide() end
end)

AddEventHandler('onClientResourceStop', function(name)
    if name == GetCurrentResourceName() and opened and GetResourceState('ox_lib') == 'started' then hide() end
end)
