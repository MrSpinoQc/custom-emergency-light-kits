'use strict';

// This entrypoint is not installed into any service. No process is launched without
// --start AND the locally pinned, explicitly coordinated global configuration.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { TextDecoder } = require('node:util');
const native = require('./prepare.cjs');
const ROOT = __dirname;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const decoder = new TextDecoder('utf-8', { fatal: true });
const plain = value => value && Object.getPrototypeOf(value) === Object.prototype;
const fields = (value, names) => plain(value) && Object.keys(value).length === names.length && names.every(n => Object.hasOwn(value, n));
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

function requireThat(condition, reason) {
    if (!condition) throw new Error(reason);
}

function within(root, target) {
    const relative = path.relative(root, target);
    return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function localPath(file, label) {
    const absolute = path.resolve(file);
    requireThat(within(ROOT, absolute) && !samePath(absolute, ROOT), `${label} must stay inside this prototype`);
    return absolute;
}

function parseArguments(args) {
    const options = { start: false };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--start') {
            requireThat(!options.start, 'Repeated --start');
            options.start = true;
        } else if (arg === '--home' || arg === '--config') {
            const key = arg === '--home' ? 'home' : 'configFile';
            requireThat(!Object.hasOwn(options, key) && i + 1 < args.length && !args[i + 1].startsWith('--'), `${arg} requires one path`);
            options[key] = args[++i];
        } else throw new Error('Unknown launcher argument: ' + arg);
    }
    return options;
}

function launchPins(configFile, home, read) {
    const bytes = read(configFile, 32768);
    const cfg = JSON.parse(decoder.decode(bytes));
    requireThat(fields(cfg, ['schema', 'version', 'coordinated', 'fxserver', 'serverConfig']) &&
        cfg.schema === 'tryagain.fxserver-launch' && cfg.version === 1 && typeof cfg.coordinated === 'boolean',
    'Global launch configuration v1 required');
    requireThat(cfg.coordinated === true, 'Launch refused: coordinated must be true after a separate agreed test slot');
    requireThat(fields(cfg.fxserver, ['file', 'sha256', 'artifactVersion']) &&
        typeof cfg.fxserver.file === 'string' && path.isAbsolute(cfg.fxserver.file) &&
        path.basename(cfg.fxserver.file).toLowerCase() === 'fxserver.exe' &&
        typeof cfg.fxserver.artifactVersion === 'string' && /^[0-9][0-9A-Za-z._+-]{0,63}$/.test(cfg.fxserver.artifactVersion),
    'Pin an absolute FXServer.exe path and explicit numeric artifactVersion');
    requireThat(fields(cfg.serverConfig, ['file', 'sha256']) && typeof cfg.serverConfig.file === 'string' &&
        cfg.serverConfig.file.length > 0 && !path.isAbsolute(cfg.serverConfig.file), 'Pin one relative global server configuration');
    const binary = path.resolve(cfg.fxserver.file);
    const serverConfig = localPath(path.resolve(home, cfg.serverConfig.file), 'Server configuration');
    requireThat(within(home, serverConfig) && path.extname(serverConfig).toLowerCase() === '.cfg', 'Server configuration must be a .cfg inside the selected instance');
    for (const [pin, label] of [[cfg.fxserver.sha256, 'FXServer'], [cfg.serverConfig.sha256, 'server configuration']])
        requireThat(typeof pin === 'string' && /^[a-f0-9]{64}$/.test(pin), `${label}: explicit lowercase SHA256 required`);
    requireThat(digest(read(binary, 256 * 1024 * 1024)) === cfg.fxserver.sha256, 'FXServer SHA256 differs from the global pin');
    const configBytes = read(serverConfig, 32768);
    requireThat(digest(configBytes) === cfg.serverConfig.sha256, 'Server configuration SHA256 differs from the global pin');
    const lines = decoder.decode(configBytes).split(/\r?\n/).map(line => line.trim()).filter(line => line && !/^(?:#|\/\/)/.test(line));
    requireThat(lines.every(line => !/^(?:start|ensure|restart|stop|exec|quit)\b/i.test(line) && !line.includes(';')),
        'Global configuration must not contain resource/process commands, nested exec or semicolon command chaining');
    return { binary, binarySHA256: cfg.fxserver.sha256, artifactVersion: cfg.fxserver.artifactVersion,
        serverConfig, serverConfigSHA256: cfg.serverConfig.sha256 };
}

function processLock(home, read) {
    // Validate ancestors before creating a lock, even before prepare checks them.
    let parent = path.parse(home).root;
    for (const part of home.slice(parent.length).split(path.sep).filter(Boolean)) {
        parent = path.join(parent, part);
        const info = fs.lstatSync(parent);
        requireThat(info.isDirectory() && !info.isSymbolicLink(), 'Instance ancestor must be a normal directory: ' + parent);
    }
    requireThat(samePath(path.resolve(fs.realpathSync(home)), home), 'Instance path is redirected');
    const file = path.join(home, '.launcher.lock');
    const token = randomUUID();
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, token + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    let released = false;
    return () => {
        if (released) return;
        released = true;
        // A stale or replaced lock is left for inspection, never stolen.
        if (read(file, 128).toString('utf8') === token + '\n') fs.unlinkSync(file);
    };
}

function launch(options = {}, dependencies = {}) {
    const prepare = dependencies.prepare || native.prepare;
    const currentAt = dependencies.currentAt || native.currentAt;
    const verifyGeneration = dependencies.verifyGeneration || native.verifyGeneration;
    const read = dependencies.read || native.read;
    const home = localPath(options.home || path.join(ROOT, 'demo'), 'Instance');
    const configFile = localPath(options.configFile || path.join(home, 'launch.json'), 'Launch configuration');
    requireThat(options.start === undefined || typeof options.start === 'boolean', 'start must be an explicit boolean');

    const release = processLock(home, read);
    let keepLock = false;
    try {
        const pins = options.start ? launchPins(configFile, home, read) : null;
        // Every admitted invocation prepares, including unchanged deposits and
        // plan-only runs. A running launch lock refuses before copying any saves.
        const prepared = prepare({ home, ...(options.withAdmin === true ? { withAdmin: true } : {}) });
        const current = currentAt(home); // Resolve CURRENT once for the entire session.
        requireThat(current && prepared && current.name === prepared.generation &&
            samePath(path.resolve(current.folder), path.resolve(prepared.folder)), 'CURRENT changed after preparation; launch refused');
        const folder = localPath(current.folder, 'Generation');
        requireThat(within(path.join(home, 'generations'), folder), 'Generation is outside this instance');
        verifyGeneration(current);
        const orderFile = path.join(folder, 'start-order.cfg');
        const expectedOrder = Buffer.from(native.startOrder(current.receipt?.startupResources, options.withAdmin === true));
        requireThat(read(orderFile, 8192).equals(expectedOrder), 'Generated start order differs from the fixed CELK order');
        const result = { mode: 'prepared-only', serverStarted: false, generation: current.name, folder,
            launchConfig: configFile, activeModels: prepared.activeModels, reports: prepared.reports,
            proof: 'Preparation and launch-plan checks only; no FXServer/GTA validation.' };
        if (!options.start) return result;

        dependencies.onPrepared?.(current);
        // Neither arguments, shell commands nor an executable may come from a pack.
        const spawn = dependencies.spawn || require('node:child_process').spawn;
        const child = spawn(pins.binary, ['+set', 'onesync', 'on', '+exec', pins.serverConfig, '+exec', orderFile], {
            cwd: folder, shell: false, windowsHide: true, stdio: 'inherit', detached: false,
        });
        requireThat(child && typeof child.once === 'function', 'Process launcher returned no observable child');
        child.once('error', error => {
            release();
            if (dependencies.onProcessError) dependencies.onProcessError(error);
            else { console.error('FXServer process error: ' + error.message); process.exitCode = 1; }
        });
        child.once('exit', (code, signal) => {
            release();
            if (dependencies.onProcessExit) dependencies.onProcessExit(code, signal);
            else process.exitCode = signal ? 1 : (code ?? 1);
        });
        keepLock = true;
        return { ...result, mode: 'launch-requested', serverStarted: false, processRequested: true, pid: child.pid ?? null,
            pins, proof: 'Process creation requested; startup, resource streaming and GTA behavior still require observation.' };
    } finally { if (!keepLock) release(); }
}

if (require.main === module) {
    try { console.log(JSON.stringify(launch(parseArguments(process.argv.slice(2))), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { launch, parseArguments, launchPins, ROOT };
