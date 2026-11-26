const dgram = require('dgram');
const os = require('os');
const http = require('http');
const net = require('net');
const { execFile } = require('child_process');

const DISCOVERY_PORT = 39123;
const APP_TAG = 'the-verity';

let clientSocket = null;
let queryTimer = null;
let backgroundScanTimer = null;
let watchdogTimer = null;
let isScanning = false;
let isWatchdogRunning = false;
let discoveredServer = null;
let mainWindowGetter = null;
let localDb = null;

// Collect all local IP addresses of this machine to prevent client from locking onto its own non-host engine
function getMyIps() {
    const interfaces = os.networkInterfaces();
    const ips = new Set(['127.0.0.1', 'localhost', '::1']);

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && iface.address) {
                ips.add(iface.address);
            }
        }
    }
    return ips;
}

function isLoopbackHost(hostname) {
    const h = String(hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

function parseHostname(url) {
    if (!url) return '';
    try {
        const clean = url.startsWith('http://') || url.startsWith('https://') ? url : `http://${url}`;
        return new URL(clean).hostname;
    } catch (_) {
        return '';
    }
}

function getBroadcastAddresses() {
    const interfaces = os.networkInterfaces();
    const broadcasts = new Set();
    broadcasts.add('255.255.255.255');

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && iface.address && iface.netmask) {
                try {
                    const ipParts = iface.address.split('.').map(Number);
                    const maskParts = iface.netmask.split('.').map(Number);
                    const bcastParts = ipParts.map((part, i) => ((part | (~maskParts[i] & 255)) & 255) >>> 0);
                    broadcasts.add(bcastParts.join('.'));
                } catch (_) {}
            }
        }
    }
    return Array.from(broadcasts);
}

// TCP port probe with explicit connect timer (avoids hung sockets on un-ARPed Wi-Fi)
function testTcpPort(host, port = 3001, timeoutMs = 600) {
    return new Promise((resolve) => {
        if (!host) return resolve(false);
        const socket = new net.Socket();
        let finished = false;

        const done = (result) => {
            if (finished) return;
            finished = true;
            try { socket.destroy(); } catch (_) {}
            resolve(result);
        };

        const timer = setTimeout(() => done(false), timeoutMs);

        socket.once('connect', () => {
            clearTimeout(timer);
            done(true);
        });
        socket.once('error', () => {
            clearTimeout(timer);
            done(false);
        });

        try {
            socket.connect(port, host);
        } catch (_) {
            clearTimeout(timer);
            done(false);
        }
    });
}

// Extract active router devices from Windows ARP table asynchronously (non-blocking)
function getArpIpsAsync() {
    return new Promise((resolve) => {
        execFile('arp', ['-a'], { timeout: 1500, windowsHide: true }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            try {
                const myIps = getMyIps();
                const matches = Array.from(new Set(String(stdout).match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []));
                resolve(matches.filter(ip =>
                    !ip.startsWith('224.') &&
                    !ip.startsWith('239.') &&
                    !ip.startsWith('255.') &&
                    !ip.endsWith('.255') &&
                    !ip.startsWith('127.') &&
                    !myIps.has(ip)
                ));
            } catch (_) {
                resolve([]);
            }
        });
    });
}

function ipToInt(ip) {
    const parts = String(ip || '').split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return null;
    return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function intToIp(num) {
    return [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255
    ].join('.');
}

function getSubnetSweepIps(ip, netmask, myIps, priorityOctets) {
    const ipInt = ipToInt(ip);
    const maskInt = ipToInt(netmask || '255.255.255.0');
    if (ipInt === null || maskInt === null) return [];

    const network = (ipInt & maskInt) >>> 0;
    const broadcast = (network | (~maskInt >>> 0)) >>> 0;
    const hostCount = broadcast > network + 1 ? (broadcast - network - 1) : 0;

    // For /24 or smaller subnets sweep the exact subnet; for wider subnets (/16, /22, etc.) scan the local /24 block around `ip`
    let start = network + 1;
    let end = broadcast - 1;
    if (hostCount > 512) {
        const local24Mask = 0xffffff00;
        const local24Net = (ipInt & local24Mask) >>> 0;
        start = local24Net + 1;
        end = local24Net + 254;
    }

    const prioritySet = new Set(priorityOctets);
    const ips = [];
    for (let cur = start; cur <= end; cur++) {
        const octet = cur & 255;
        if (prioritySet.has(octet)) continue;
        const candidate = intToIp(cur >>> 0);
        if (!myIps.has(candidate)) ips.push(candidate);
    }
    return ips;
}

function normalizeHttpUrl(url) {
    if (!url) return '';
    let cleanUrl = String(url).trim().replace(/\/$/, '');
    if (!cleanUrl) return '';
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `http://${cleanUrl}`;
    }
    return cleanUrl;
}

function fetchServerHealth(cleanUrl, timeoutMs = 1500) {
    return new Promise((resolve) => {
        try {
            let finished = false;
            const done = (res) => {
                if (finished) return;
                finished = true;
                resolve(res);
            };

            const req = http.get(`${cleanUrl}/health`, { timeout: timeoutMs }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(data);
                    } catch (_) {}
                    done({ statusCode: res.statusCode, parsed });
                });
            });

            const timer = setTimeout(() => {
                try { req.destroy(); } catch (_) {}
                done(null);
            }, timeoutMs);

            req.on('error', () => {
                clearTimeout(timer);
                done(null);
            });
            req.on('timeout', () => {
                clearTimeout(timer);
                try { req.destroy(); } catch (_) {}
                done(null);
            });
        } catch (_) {
            resolve(null);
        }
    });
}

// Verify that a given URL is a real Verity Server and NOT ourselves (unless testing as host)
async function verifyHttpServer(url, timeoutMs = 1500, allowSelfIfHost = true) {
    const cleanUrl = normalizeHttpUrl(url);
    if (!cleanUrl) return false;

    try {
        const parsedUrl = new URL(cleanUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;
        const host = parsedUrl.hostname;
        const myIps = getMyIps();
        const isSelf = myIps.has(host);

        const health = await fetchServerHealth(cleanUrl, timeoutMs);
        if (!health || health.statusCode < 200 || health.statusCode >= 400) return false;

        const { parsed } = health;
        if (!parsed || parsed.app !== APP_TAG) return false;

        if (isSelf && !allowSelfIfHost) return false;
        if (isSelf && parsed.isHost !== true) return false;
        return true;
    } catch (_) {
        return false;
    }
}

// Resolve a requested server URL to a reachable LAN IP URL when loopback points to a local Host
async function resolveLanHostUrl(url, timeoutMs = 2000) {
    const cleanUrl = normalizeHttpUrl(url);
    if (!cleanUrl) return null;

    if (!isLoopbackHost(parseHostname(cleanUrl))) {
        const ok = await verifyHttpServer(cleanUrl, timeoutMs);
        return ok ? cleanUrl : null;
    }

    const health = await fetchServerHealth(cleanUrl, timeoutMs);
    const parsed = health?.parsed;
    if (!parsed || (parsed.app !== APP_TAG && parsed.status !== 'operational')) {
        return null;
    }

    let port = '3001';
    try {
        port = new URL(cleanUrl).port || '3001';
    } catch (_) {}

    const lanIps = Array.isArray(parsed.lanIps) ? parsed.lanIps : [];
    for (const ip of lanIps) {
        if (!ip || isLoopbackHost(ip)) continue;
        const lanUrl = `http://${ip}:${port}`;
        if (await verifyHttpServer(lanUrl, timeoutMs, true)) {
            return lanUrl;
        }
    }
    return null;
}

async function setDiscoveredServer(url) {
    if (!url) {
        if (localDb && typeof localDb.setLocal === 'function') {
            try {
                await Promise.resolve(localDb.setLocal('verity_lan_server', null));
            } catch (_) {}
        }
        if (discoveredServer !== null) {
            console.log('📡 [LAN Client] Disconnected from Verity Host Server');
            discoveredServer = null;
            if (mainWindowGetter) {
                try {
                    const win = mainWindowGetter();
                    if (win && !win.isDestroyed() && win.webContents) {
                        win.webContents.send('lan-server-discovered', null);
                    }
                } catch (_) {}
            }
        }
        return;
    }
    const cleanUrl = normalizeHttpUrl(url);
    if (!cleanUrl || isLoopbackHost(parseHostname(cleanUrl))) {
        return;
    }
    discoveredServer = cleanUrl;
    console.log(`🎯 [LAN Client] Locked onto Verity Host Server: ${cleanUrl}`);

    if (localDb && typeof localDb.setLocal === 'function') {
        try {
            await Promise.resolve(localDb.setLocal('verity_lan_server', cleanUrl));
        } catch (_) {}
    }

    if (mainWindowGetter) {
        try {
            const win = mainWindowGetter();
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send('lan-server-discovered', cleanUrl);
            }
        } catch (_) {}
    }
}

function sendDiscoveryQuery() {
    if (!clientSocket) return;
    try {
        const payload = Buffer.from(JSON.stringify({
            app: APP_TAG,
            type: 'discover',
            hostname: os.hostname(),
            timestamp: Date.now()
        }));

        const targets = getBroadcastAddresses();
        for (const target of targets) {
            try {
                clientSocket.send(payload, 0, payload.length, DISCOVERY_PORT, target);
            } catch (_) {}
        }
    } catch (_) {}
}

async function tryCandidates(candidateList) {
    for (const cand of candidateList) {
        if (discoveredServer) return true;
        if (!cand) continue;
        const testUrl = cand.startsWith('http') ? cand : `http://${cand}:3001`;
        const hostname = parseHostname(testUrl);
        if (!hostname || isLoopbackHost(hostname)) continue;

        const ok = await verifyHttpServer(testUrl, 1000);
        if (ok) {
            await setDiscoveredServer(testUrl);
            return true;
        }
    }
    return false;
}

// Multi-tiered high-speed scanner
async function runDiscoveryScan(force = false) {
    if (isScanning) return;
    if (discoveredServer && !force) return;
    isScanning = true;

    try {
        const myIps = getMyIps();

        // 0. High priority: check previously saved host from local SQLite
        if (localDb && typeof localDb.getLocal === 'function') {
            try {
                const cached = await Promise.resolve(localDb.getLocal('verity_lan_server'));
                if (typeof cached === 'string' && cached.trim()) {
                    const clean = normalizeHttpUrl(cached);
                    const hostname = parseHostname(clean);
                    if (hostname && isLoopbackHost(hostname)) {
                        await Promise.resolve(localDb.setLocal('verity_lan_server', null));
                    } else if (hostname) {
                        const ok = await verifyHttpServer(clean, 700);
                        if (ok) {
                            await setDiscoveredServer(clean);
                            return;
                        }
                    }
                }
            } catch (_) {}
        }

        // 1. ARP Cache: all active devices currently communicating on the router
        const arpIps = await getArpIpsAsync();
        if (arpIps.length > 0) {
            for (const ip of arpIps) {
                if (discoveredServer && !force) break;
                const testUrl = `http://${ip}:3001`;
                const ok = await verifyHttpServer(testUrl, 600);
                if (ok) {
                    await setDiscoveredServer(testUrl);
                    return;
                }
            }
        }

        // 2. High-probability ComLab default IPs
        const defaultCandidates = [
            'http://192.168.254.100:3001',
            'http://192.168.254.101:3001',
            'http://192.168.1.10:3001',
            'http://192.168.1.100:3001',
            'http://192.168.254.1:3001',
            'http://192.168.1.1:3001'
        ].filter(url => {
            try { return !myIps.has(new URL(url).hostname); } catch (_) { return false; }
        });

        for (const url of defaultCandidates) {
            if (discoveredServer && !force) break;
            const ok = await verifyHttpServer(url, 600);
            if (ok) {
                await setDiscoveredServer(url);
                return;
            }
        }

        // 3. Subnet Priority Probes: test common host octets on active interfaces
        const interfaces = os.networkInterfaces();
        const activeSubnets = [];

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (
                    iface.family === 'IPv4' && 
                    !iface.internal && 
                    iface.address && 
                    !iface.address.startsWith('127.') &&
                    !iface.address.startsWith('169.254.') &&
                    !iface.address.startsWith('192.168.56.')
                ) {
                    activeSubnets.push({ address: iface.address, netmask: iface.netmask || '255.255.255.0' });
                }
            }
        }

        const priorityOctets = [100, 101, 10, 1, 2, 20, 50, 254];

        for (const subnet of activeSubnets) {
            const myIp = subnet.address;
            if (discoveredServer && !force) break;
            const prefix = myIp.substring(0, myIp.lastIndexOf('.') + 1);
            const priorityIps = priorityOctets
                .map(o => `${prefix}${o}`)
                .filter(ip => !myIps.has(ip));

            await Promise.all(priorityIps.map(async (ip) => {
                if (discoveredServer && !force) return;
                const testUrl = `http://${ip}:3001`;
                const ok = await verifyHttpServer(testUrl, 500);
                if (ok) {
                    await setDiscoveredServer(testUrl);
                }
            }));
            if (discoveredServer && !force) return;

            // 4. Fast Subnet Sweep in parallel batches of 35 using TCP connect probe (true netmask bounded)
            const remaining = getSubnetSweepIps(myIp, subnet.netmask, myIps, priorityOctets);

            const batchSize = 35;
            for (let b = 0; b < remaining.length; b += batchSize) {
                if (discoveredServer && !force) break;
                const batch = remaining.slice(b, b + batchSize);
                await Promise.all(batch.map(async (ip) => {
                    if (discoveredServer && !force) return;
                    const tcpUp = await testTcpPort(ip, 3001, 200);
                    if (tcpUp) {
                        const testUrl = `http://${ip}:3001`;
                        const ok = await verifyHttpServer(testUrl, 600);
                        if (ok) {
                            await setDiscoveredServer(testUrl);
                        }
                    }
                }));
            }
        }

        // 5. Fallback for single-PC Host testing: check this machine's own non-loopback LAN IPs (accepted only if isHost === true)
        if (!discoveredServer) {
            for (const subnet of activeSubnets) {
                if (discoveredServer) break;
                const testUrl = `http://${subnet.address}:3001`;
                const ok = await verifyHttpServer(testUrl, 500, true);
                if (ok) {
                    await setDiscoveredServer(testUrl);
                    return;
                }
            }
        }
    } finally {
        isScanning = false;
    }
}

function initLanClient(getWin, dbAPI) {
    mainWindowGetter = getWin;
    localDb = dbAPI;

    // Load previously cached LAN server if any (localDb.getLocal is synchronous, guard with Promise.resolve)
    if (localDb && typeof localDb.getLocal === 'function') {
        Promise.resolve()
            .then(() => localDb.getLocal('verity_lan_server'))
            .then((cached) => {
                if (!cached || typeof cached !== 'string') return;
                if (isLoopbackHost(parseHostname(cached))) {
                    if (typeof localDb.setLocal === 'function') {
                        Promise.resolve(localDb.setLocal('verity_lan_server', null)).catch(() => {});
                    }
                    return;
                }
                if (!discoveredServer) {
                    verifyHttpServer(cached, 1000).then((ok) => {
                        if (ok && !discoveredServer) {
                            setDiscoveredServer(cached);
                        }
                    }).catch(() => {});
                }
            })
            .catch(() => {});
    }

    try {
        clientSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        clientSocket.on('error', (err) => {
            console.warn(`[LAN Client] UDP socket notice: ${err.message}`);
        });

        clientSocket.on('message', async (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data && data.app === APP_TAG && data.type === 'beacon') {
                    const portNum = Number(data.port || 3001);
                    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return;
                    const isValidBeaconUrl = (raw) => {
                        try {
                            const u = new URL(normalizeHttpUrl(raw));
                            if (u.protocol !== 'http:' || u.username || u.password) return false;
                            return Boolean(ipToInt(u.hostname));
                        } catch (_) {
                            return false;
                        }
                    };
                    const candidates = [
                        `http://${rinfo.address}:${portNum}`,
                        ...(typeof data.serverUrl === 'string' && isValidBeaconUrl(data.serverUrl) ? [data.serverUrl] : []),
                        ...((Array.isArray(data.candidateUrls) ? data.candidateUrls : []).filter(u => typeof u === 'string' && isValidBeaconUrl(u))),
                        ...((Array.isArray(data.ips) ? data.ips : []).filter(ip => typeof ip === 'string' && ipToInt(ip) !== null).map(ip => `http://${ip}:${portNum}`))
                    ].filter(Boolean);

                    await tryCandidates(candidates);
                }
            } catch (_) {}
        });

        clientSocket.bind(0, () => {
            try {
                clientSocket.setBroadcast(true);
            } catch (_) {}

            console.log('🔍 [LAN Client] Active: Searching for Verity Host Server on local network...');
            sendDiscoveryQuery();
        });

    } catch (err) {
        console.warn(`[LAN Client] Initialization warning: ${err.message}`);
    }

    // 1. Initial immediate scan
    setTimeout(() => {
        if (!discoveredServer) {
            runDiscoveryScan();
        }
    }, 50);

    // 2. Periodic UDP Discovery queries every 2 seconds while searching
    queryTimer = setInterval(() => {
        if (!discoveredServer) {
            sendDiscoveryQuery();
        }
    }, 2000);

    // 3. Continuous background subnet and ARP scan every 3 seconds while searching
    backgroundScanTimer = setInterval(() => {
        if (!discoveredServer) {
            runDiscoveryScan();
        }
    }, 3000);

    // 4. Watchdog: every 2 seconds verify that locked server is still reachable.
    // Guard against overlapping runs when network probes exceed the interval.
    watchdogTimer = setInterval(async () => {
        if (isWatchdogRunning) return;
        isWatchdogRunning = true;
        try {
            const interfaces = os.networkInterfaces();
            let hasActiveInterface = false;
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal && iface.address && !iface.address.startsWith('127.') && !iface.address.startsWith('169.254.')) {
                        hasActiveInterface = true;
                        break;
                    }
                }
                if (hasActiveInterface) break;
            }

            if (!hasActiveInterface) {
                if (discoveredServer) {
                    console.log('⚠️ [LAN Client] No network connection detected. Disconnecting LAN server...');
                    await setDiscoveredServer(null);
                }
                return;
            }

            if (discoveredServer) {
                const alive = await verifyHttpServer(discoveredServer, 1000);
                if (!alive) {
                    console.log(`⚠️ [LAN Client] Lost contact with host (${discoveredServer}). Resuming discovery...`);
                    await setDiscoveredServer(null);
                    await runDiscoveryScan();
                }
            } else {
                await runDiscoveryScan();
            }
        } finally {
            isWatchdogRunning = false;
        }
    }, 2000);
}

function getDiscoveredServer() {
    return discoveredServer;
}

function stopLanClient() {
    if (queryTimer) {
        clearInterval(queryTimer);
        queryTimer = null;
    }
    if (backgroundScanTimer) {
        clearInterval(backgroundScanTimer);
        backgroundScanTimer = null;
    }
    if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
    }
    if (clientSocket) {
        try { clientSocket.close(); } catch (_) {}
        clientSocket = null;
    }
}

module.exports = {
    initLanClient,
    getDiscoveredServer,
    setDiscoveredServer,
    verifyHttpServer,
    resolveLanHostUrl,
    runDiscoveryScan,
    stopLanClient,
    getSubnetSweepIps
};
