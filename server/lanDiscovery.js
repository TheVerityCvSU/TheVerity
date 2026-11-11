const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 39123;
const APP_TAG = 'the-verity';

let beaconSocket = null;
let beaconTimer = null;
let isRunning = false;

// Return all valid, reachable physical IPv4 network interfaces (excluding virtual/APIPA/internal)
function getValidNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const results = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (
                iface.family === 'IPv4' &&
                !iface.internal &&
                iface.address &&
                !iface.address.startsWith('127.') &&
                !iface.address.startsWith('169.254.') && // exclude Windows APIPA
                !iface.address.startsWith('192.168.56.') // exclude VirtualBox host-only
            ) {
                let broadcast = '255.255.255.255';
                if (iface.netmask) {
                    try {
                        const ipParts = iface.address.split('.').map(Number);
                        const maskParts = iface.netmask.split('.').map(Number);
                        const bcastParts = ipParts.map((part, i) => (part | (~maskParts[i] & 255)) >>> 0);
                        broadcast = bcastParts.join('.');
                    } catch (_) { }
                }
                results.push({
                    name,
                    ip: iface.address,
                    broadcast,
                    netmask: iface.netmask
                });
            }
        }
    }
    return results;
}

function getLanIpAddresses() {
    return getValidNetworkInterfaces().map(i => i.ip);
}

// Find the server IP that matches the client's subnet (e.g. matching 192.168.1.X)
function findBestMatchingServerIp(clientIp) {
    const ifaces = getValidNetworkInterfaces();
    if (ifaces.length === 0) return '127.0.0.1';
    if (!clientIp) return ifaces[0].ip;

    const cParts = clientIp.split('.');
    for (const iface of ifaces) {
        const sParts = iface.ip.split('.');
        if (cParts[0] === sParts[0] && cParts[1] === sParts[1] && cParts[2] === sParts[2]) {
            return iface.ip;
        }
    }
    return ifaces[0].ip;
}

/**
 * Starts the LAN Discovery beacon and query responder.
 * @param {number} httpPort HTTP port where Verity Server is listening (e.g. 3001)
 * @param {boolean} isHost Whether this instance is acting as the designated Teacher/Host Server
 */
function startLanDiscovery(httpPort = 3001, isHost = true) {
    if (isRunning) return;
    if (!isHost) {
        return;
    }

    try {
        beaconSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        beaconSocket.on('error', (err) => {
            console.warn(`[LAN Discovery] UDP Socket notice: ${err.message}`);
        });

        beaconSocket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data && data.app === APP_TAG && data.type === 'discover') {
                    // Match the server IP to the client's subnet!
                    const matchedIp = findBestMatchingServerIp(rinfo.address);
                    const allIps = getLanIpAddresses();
                    const candidateUrls = allIps.map(ip => `http://${ip}:${httpPort}`);

                    const response = Buffer.from(JSON.stringify({
                        app: APP_TAG,
                        type: 'beacon',
                        role: 'host',
                        port: httpPort,
                        primaryIp: matchedIp,
                        serverUrl: `http://${matchedIp}:${httpPort}`,
                        ips: allIps,
                        candidateUrls: candidateUrls,
                        hostname: os.hostname(),
                        timestamp: Date.now()
                    }));

                    beaconSocket.send(response, 0, response.length, rinfo.port, rinfo.address, (sErr) => {
                        if (!sErr) {
                            console.log(`[LAN Discovery] Client discovered from ${rinfo.address} -> matched server URL: http://${matchedIp}:${httpPort}`);
                        }
                    });
                }
            } catch (_) { }
        });

        beaconSocket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
            try {
                beaconSocket.setBroadcast(true);
            } catch (_) { }

            isRunning = true;
            console.log(`[LAN Discovery] Host Beacon active on UDP port ${DISCOVERY_PORT} (HTTP port: ${httpPort})`);

            const sendBeacon = () => {
                if (!isRunning || !beaconSocket) return;
                try {
                    const ifaces = getValidNetworkInterfaces();
                    if (ifaces.length === 0) return;

                    const allIps = ifaces.map(i => i.ip);
                    const candidateUrls = allIps.map(ip => `http://${ip}:${httpPort}`);

                    // Send interface-specific beacon to each subnet's broadcast
                    for (const iface of ifaces) {
                        try {
                            const payload = Buffer.from(JSON.stringify({
                                app: APP_TAG,
                                type: 'beacon',
                                role: 'host',
                                port: httpPort,
                                primaryIp: iface.ip,
                                serverUrl: `http://${iface.ip}:${httpPort}`,
                                ips: allIps,
                                candidateUrls: candidateUrls,
                                hostname: os.hostname(),
                                timestamp: Date.now()
                            }));

                            beaconSocket.send(payload, 0, payload.length, DISCOVERY_PORT, iface.broadcast);
                        } catch (_) { }
                    }

                    // Also broadcast to global 255.255.255.255
                    try {
                        const globalPayload = Buffer.from(JSON.stringify({
                            app: APP_TAG,
                            type: 'beacon',
                            role: 'host',
                            port: httpPort,
                            primaryIp: ifaces[0].ip,
                            serverUrl: `http://${ifaces[0].ip}:${httpPort}`,
                            ips: allIps,
                            candidateUrls: candidateUrls,
                            hostname: os.hostname(),
                            timestamp: Date.now()
                        }));
                        beaconSocket.send(globalPayload, 0, globalPayload.length, DISCOVERY_PORT, '255.255.255.255');
                    } catch (_) { }

                    // Also send direct unicast beacons to every active device in the ARP table
                    // Unicast UDP bypasses router broadcast suppression and client isolation!
                    try {
                        const { execSync } = require('child_process');
                        const arpOut = execSync('arp -a', { timeout: 1000, windowsHide: true }).toString();
                        const matches = Array.from(new Set(arpOut.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []));
                        const targetIps = matches.filter(ip =>
                            !ip.startsWith('224.') &&
                            !ip.startsWith('239.') &&
                            !ip.startsWith('255.') &&
                            !ip.endsWith('.255') &&
                            !ip.startsWith('127.') &&
                            !allIps.includes(ip)
                        );
                        for (const targetIp of targetIps) {
                            try {
                                const matchedIp = findBestMatchingServerIp(targetIp);
                                const unicastPayload = Buffer.from(JSON.stringify({
                                    app: APP_TAG,
                                    type: 'beacon',
                                    role: 'host',
                                    port: httpPort,
                                    primaryIp: matchedIp,
                                    serverUrl: `http://${matchedIp}:${httpPort}`,
                                    ips: allIps,
                                    candidateUrls: candidateUrls,
                                    hostname: os.hostname(),
                                    timestamp: Date.now()
                                }));
                                beaconSocket.send(unicastPayload, 0, unicastPayload.length, DISCOVERY_PORT, targetIp);
                            } catch (_) { }
                        }
                    } catch (_) { }

                } catch (_) { }
            };

            sendBeacon();
            beaconTimer = setInterval(sendBeacon, 2500);
        });

    } catch (err) {
        console.warn(`[LAN Discovery] Could not initialize LAN Discovery: ${err.message}`);
    }
}

function stopLanDiscovery() {
    isRunning = false;
    if (beaconTimer) {
        clearInterval(beaconTimer);
        beaconTimer = null;
    }
    if (beaconSocket) {
        try {
            beaconSocket.close();
        } catch (_) { }
        beaconSocket = null;
    }
}

module.exports = {
    startLanDiscovery,
    stopLanDiscovery,
    getLanIpAddresses,
    findBestMatchingServerIp,
    DISCOVERY_PORT,
    APP_TAG
};
