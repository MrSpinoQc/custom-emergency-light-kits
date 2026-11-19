'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { launch, parseArguments } = require('./launcher.cjs');
const { createAdminServer } = require('./admin-host.cjs');
const { ROOT, normal, replace } = require('./prepare.cjs');

function protectWindowsBridgeConfig(file) {
    const system32 = path.join(process.env.SystemRoot, 'System32');
    const options = { windowsHide: true, timeout: 5000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
    const identity = execFileSync(path.join(system32, 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], options);
    const sid = /"(S-1-\d+(?:-\d+)+)"\s*$/.exec(identity)?.[1];
    if (!sid) throw Error('Impossible de vérifier le compte Windows du pont CELK.');
    const accounts = [...new Set([sid, 'S-1-5-18'])];
    execFileSync(path.join(system32, 'icacls.exe'),
        [file, '/inheritance:r', '/grant:r', ...accounts.map(account => '*' + account + ':(F)')], options);
}

async function run(options, dependencies = {}) {
    const launchProcess = dependencies.spawn ?? spawn;
    const home = path.resolve(options.home ?? path.join(ROOT, 'demo'));
    const relative = path.relative(ROOT, home);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !normal(home).isDirectory()) {
        throw Error('Une instance normale sous CELK est requise');
    }
    if (!options.start) return launch({ ...options, home, withAdmin: true });

    let active;
    const key = randomBytes(32).toString('hex');
    const server = createAdminServer({ home, current: () => active, key });
    const secret = path.join(home, '.celk-admin-' + randomBytes(12).toString('hex') + '.cfg');
    const diagnostic = path.join(home, 'dernier-demarrage-admin.json');
    let created = false;
    function report(data) {
        try {
            replace(diagnostic, Buffer.from(JSON.stringify({ ...data, at: new Date().toISOString() }) + '\n'));
        } catch (error) {
            console.error('Diagnostic de démarrage non écrit : ' + error.message);
        }
    }
    function close() {
        server.close();
        if (created) {
            fs.unlinkSync(secret);
            created = false;
        }
    }
    try {
        const listening = once(server, 'listening');
        server.listen(0, '127.0.0.1');
        await listening;
        const fd = fs.openSync(secret, 'wx', 0o600);
        created = true;
        try {
            if (process.platform === 'win32') protectWindowsBridgeConfig(secret);
            fs.writeFileSync(fd, [
                'add_convar_permission celk_admin read celk_admin_key',
                'set celk_admin_port ' + server.address().port,
                'set celk_admin_key ' + key + '\n',
            ].join('\n'));
        } finally { fs.closeSync(fd); }
        const result = launch({ ...options, home, withAdmin: true }, {
            onPrepared: current => { active = current; },
            spawn: (binary, args, settings) => launchProcess(binary, [...args.slice(0, -2), '+exec', secret, ...args.slice(-2)], settings),
            onProcessError: error => {
                close();
                report({ status: 'process-error', message: error.message });
                console.error(error.message);
                process.exitCode = 1;
            },
            onProcessExit: (code, signal) => {
                close();
                report({ status: 'process-exit', generation: active?.name, code, signal });
                process.exitCode = signal ? 1 : (code ?? 1);
            },
        });
        report({ status: 'launch-requested', generation: result.generation });
        return result;
    } catch (error) {
        close();
        report({ status: 'refused', message: error.message });
        throw error;
    }
}

if (require.main === module) {
    run(parseArguments(process.argv.slice(2))).then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { run };
