const dgram = require('dgram');
const os = require('os');
const http = require('http');
const net = require('net');
const { execSync } = require('child_process');

const DISCOVERY_PORT = 39123;
const APP_TAG = 'the-verity';

let clientSocket = null;
let queryTimer = null;
let backgroundScanTimer = null;
let watchdogTimer = null;
let isScanning = false;
let discoveredServer = null;
let mainWindowGetter = null;
let localDb = null;

// Collect all local IP addresses of this machine to prevent client from locking onto itself
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
                    const bcastParts = ipParts.map((part, i) => (part | (~maskParts[i] & 255)) >>> 0);
                    broadcasts.add(bcastParts.join('.'));
                } catch (_) {}
            }
        }
    }
    return Array.from(broadcasts);
}

// Ultra-fast TCP port probe (1-3ms for active host, 280ms timeout for closed)
function testTcpPort(host, port = 3001, timeoutMs = 280) {
    return new Promise((resolve) => {
        if (!host) return resolve(false);
        const socket = new net.Socket();
        let finished = false;

        const done = (result) => {
            if (finished) return;
            finished = true;
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));

        try {
            socket.connect(port, host);
        } catch (_) {
            done(false);
        }
    });
}

// Extract active router devices from Windows ARP table instantly (0-5ms)
function getArpIps() {
    try {
        const out = execSync('arp -a', { timeout: 1500, windowsHide: true }).toString();
        const myIps = getMyIps();
        const matches = Array.from(new Set(out.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []));
        return matches.filter(ip => 
            !ip.startsWith('224.') && 
            !ip.startsWith('239.') && 
            !ip.startsWith('255.') && 
            !ip.endsWith('.255') && 
            !ip.startsWith('127.') &&
            !myIps.has(ip)
        );
    } catch (_) {
        return [];
    }
}

// Verify that a given URL is a real Verity Server and NOT ourselves
async function verifyHttpServer(url, timeoutMs = 1200) {
    if (!url) return false;
    let cleanUrl = url.trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `http://${cleanUrl}`;
    }

    try {
        const parsedUrl = new URL(cleanUrl);
        const host = parsedUrl.hostname;
        const port = parseInt(parsedUrl.port, 10) || 3001;
        const myIps = getMyIps();

        // Never lock onto self
        if (myIps.has(host)) return false;

        // Pre-check raw TCP port before attempting HTTP to avoid hanging sockets
        const tcpUp = await testTcpPort(host, port, 350);
        if (!tcpUp) return false;

        return await new Promise((resolve) => {
            const req = http.get(`${cleanUrl}/health`, { timeout: timeoutMs }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed && (parsed.app === APP_TAG || parsed.status === 'operational')) {
                            return resolve(true);
                        }
                    } catch (_) {}
                    resolve(res.statusCode >= 200 && res.statusCode < 400);
                });
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    } catch (_) {
        return false;
    }
}

async function setDiscoveredServer(url) {
    if (!url) return;
    const cleanUrl = url.replace(/\/$/, '');
    
    if (discoveredServer === cleanUrl) return;

    discoveredServer = cleanUrl;
    console.log(`🎯 [LAN Client] Locked onto Verity Host Server: ${cleanUrl}`);

    if (localDb && typeof localDb.setLocal === 'function') {
        try {
            await localDb.setLocal('verity_lan_server', cleanUrl);
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
    const myIps = getMyIps();
    for (const cand of candidateList) {
        if (discoveredServer) return true;
        if (!cand) continue;
        const testUrl = cand.startsWith('http') ? cand : `http://${cand}:3001`;
        try {
            const u = new URL(testUrl);
            if (myIps.has(u.hostname)) continue;
        } catch (_) {}

        const ok = await verifyHttpServer(testUrl, 1000);
        if (ok) {
            await setDiscoveredServer(testUrl);
            return true;
        }
    }
    return false;
}

// Multi-tiered high-speed scanner
async function runDiscoveryScan() {
    if (discoveredServer || isScanning) return;
    isScanning = true;

    try {
        const myIps = getMyIps();

        // 1. ARP Cache: all active devices currently communicating on the router
        const arpIps = getArpIps();
        if (arpIps.length > 0) {
            for (const ip of arpIps) {
                if (discoveredServer) break;
                const testUrl = `http://${ip}:3001`;
                const ok = await verifyHttpServer(testUrl, 800);
                if (ok && !discoveredServer) {
                    await setDiscoveredServer(testUrl);
                    return;
                }
            }
        }

        // 2. High-probability ComLab default IPs
        const defaultCandidates = [
            'http://192.168.254.101:3001',
            'http://192.168.1.10:3001',
            'http://192.168.254.100:3001',
            'http://192.168.1.100:3001',
            'http://192.168.254.1:3001',
            'http://192.168.1.1:3001'
        ].filter(url => {
            try { return !myIps.has(new URL(url).hostname); } catch (_) { return false; }
        });

        for (const url of defaultCandidates) {
            if (discoveredServer) break;
            const ok = await verifyHttpServer(url, 700);
            if (ok && !discoveredServer) {
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
                    activeSubnets.push(iface.address);
                }
            }
        }

        const priorityOctets = [101, 100, 10, 1, 2, 20, 50, 254];

        for (const myIp of activeSubnets) {
            if (discoveredServer) break;
            const prefix = myIp.substring(0, myIp.lastIndexOf('.') + 1);
            const priorityIps = priorityOctets
                .map(o => `${prefix}${o}`)
                .filter(ip => !myIps.has(ip));

            await Promise.all(priorityIps.map(async (ip) => {
                if (discoveredServer) return;
                const testUrl = `http://${ip}:3001`;
                const ok = await verifyHttpServer(testUrl, 600);
                if (ok && !discoveredServer) {
                    await setDiscoveredServer(testUrl);
                }
            }));
            if (discoveredServer) return;

            // 4. Fast Subnet Sweep in parallel batches of 25 using TCP connect probe
            const remaining = [];
            for (let i = 1; i <= 254; i++) {
                if (!priorityOctets.includes(i)) {
                    const testIp = `${prefix}${i}`;
                    if (!myIps.has(testIp)) remaining.push(testIp);
                }
            }

            const batchSize = 25;
            for (let b = 0; b < remaining.length; b += batchSize) {
                if (discoveredServer) break;
                const batch = remaining.slice(b, b + batchSize);
                await Promise.all(batch.map(async (ip) => {
                    if (discoveredServer) return;
                    const tcpUp = await testTcpPort(ip, 3001, 250);
                    if (tcpUp && !discoveredServer) {
                        const testUrl = `http://${ip}:3001`;
                        const ok = await verifyHttpServer(testUrl, 800);
                        if (ok && !discoveredServer) {
                            await setDiscoveredServer(testUrl);
                        }
                    }
                }));
            }
        }
    } finally {
        isScanning = false;
    }
}

function initLanClient(getWin, dbAPI) {
    mainWindowGetter = getWin;
    localDb = dbAPI;

    // Load previously cached LAN server if any
    if (localDb && typeof localDb.getLocal === 'function') {
        localDb.getLocal('verity_lan_server').then((cached) => {
            if (cached && !discoveredServer) {
                verifyHttpServer(cached).then((ok) => {
                    if (ok && !discoveredServer) {
                        setDiscoveredServer(cached);
                    }
                });
            }
        }).catch(() => {});
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
                    const candidates = [
                        `http://${rinfo.address}:${data.port || 3001}`,
                        data.serverUrl,
                        ...(data.candidateUrls || []),
                        ...(data.ips || []).map(ip => `http://${ip}:${data.port || 3001}`)
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

    // 3. Continuous background subnet and ARP scan every 3.5 seconds while searching
    backgroundScanTimer = setInterval(() => {
        if (!discoveredServer) {
            runDiscoveryScan();
        }
    }, 3500);

    // 4. Watchdog: every 7 seconds verify that locked server is still reachable.
    // If router disconnects or host shuts down, smoothly unlock and resume scanning.
    watchdogTimer = setInterval(async () => {
        if (discoveredServer) {
            const alive = await verifyHttpServer(discoveredServer, 1500);
            if (!alive) {
                console.log(`⚠️ [LAN Client] Lost contact with host (${discoveredServer}). Resuming discovery...`);
                discoveredServer = null;
                if (mainWindowGetter) {
                    try {
                        const win = mainWindowGetter();
                        if (win && !win.isDestroyed() && win.webContents) {
                            win.webContents.send('lan-server-discovered', null);
                        }
                    } catch (_) {}
                }
                runDiscoveryScan();
            }
        }
    }, 7000);
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
    stopLanClient
};
