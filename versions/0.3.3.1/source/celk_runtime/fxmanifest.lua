fx_version 'cerulean'
game 'gta5'
author 'Spino'
version '0.3.3-sadler.1'
celk_interface_version '0.3.3.1'
description 'Custom Emergency Light Kits'

dependencies { '/onesync', '/server:38435', '/gameBuild:3889' }
node_version '22'
server_script 'server/main.js'
client_scripts {
    'client/light-timeline.lua', 'client/hellfire-v06.lua', 'client/common-optics.lua',
    'client/sadler-ramp.lua', 'client/render.lua', 'client/menu.lua', 'client/controls.lua'
}

ui_page 'ui/index.html'
files { 'installation-limits.json', 'ui/index.html', 'ui/menu.css', 'ui/menu.js' }
