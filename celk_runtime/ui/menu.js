'use strict';

const menu = document.querySelector('#menu');
const choices = document.querySelector('#choices');
const closeButton = document.querySelector('#close');

function reply(action, data = {}) {
    fetch(`https://${GetParentResourceName()}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(data),
    }).catch(() => {});
}

function addChoices(parent, items, selected) {
    for (const { id, label } of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-pressed', String(selected === id));
        button.addEventListener('click', () => reply('select', { id }));
        parent.appendChild(button);
    }
}

window.addEventListener('message', ({ data }) => {
    if (data?.type === 'close') { menu.hidden = true; return; }
    if (data?.type !== 'open' || !Array.isArray(data.options?.choices)) return;
    const { pane, choices: items, selected } = data.options;
    choices.replaceChildren();
    document.querySelector('#title').textContent = pane === 'variants' ? 'Montages' : 'Scènes';
    if (pane === 'variants') {
        for (const [service, label] of [['police', 'Police'], ['ambulance', 'Ambulance']]) {
            const group = items.filter(item => item.service === service);
            if (!group.length) continue;
            const section = document.createElement('section');
            const heading = document.createElement('h2');
            heading.textContent = label;
            section.appendChild(heading);
            addChoices(section, group, selected);
            choices.appendChild(section);
        }
    } else addChoices(choices, items, selected);
    menu.hidden = false;
    (choices.querySelector('button[aria-pressed="true"], button') ?? closeButton).focus();
});

closeButton.addEventListener('click', () => reply('close'));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) reply('close'); });
