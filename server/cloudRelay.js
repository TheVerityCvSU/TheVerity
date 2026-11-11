/**
 * The Verity - Cloud Live Monitoring Socket Relay
 * 
 * Bridges local ComLab LAN Server socket events to Render Cloud (https://verity-2z4v.onrender.com).
 * This allows teachers accessing the LMS via Vercel (or any external web browser) to see students who are
 * participating from offline ComLab laptops connected to the local LAN Server in real-time.
 */

const ioClient = require('socket.io-client');

const CLOUD_URL = process.env.CLOUD_SOCKET_URL || process.env.CLOUD_API_URL || 'https://verity-2z4v.onrender.com';
const isRenderCloud = Boolean(
    process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.IS_RENDER_SERVICE
);

let cloudSocket = null;
let isConnected = false;
let activeStudentsRef = null;
let localIoRef = null;
let heartbeatTimer = null;

function initCloudRelay(activeStudents, localIo) {
    if (isRenderCloud) {
        console.log('[Cloud Relay] Running directly on Render Cloud. Outbound relay disabled.');
        return;
    }

    activeStudentsRef = activeStudents;
    localIoRef = localIo;

    try {
        console.log(`[Cloud Relay] Initializing bridge to Cloud Server at ${CLOUD_URL}...`);
        cloudSocket = ioClient(CLOUD_URL, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            timeout: 8000,
            transports: ['websocket', 'polling']
        });

        cloudSocket.on('connect', () => {
            isConnected = true;
            console.log(`[Cloud Relay] Successfully connected LAN Server to Cloud at ${CLOUD_URL}`);
            syncAllToCloud();
        });

        cloudSocket.on('disconnect', () => {
            isConnected = false;
            console.log('[Cloud Relay] Disconnected from Cloud Server.');
        });

        cloudSocket.on('connect_error', (err) => {
            isConnected = false;
        });

        // When a remote teacher on Vercel requests sync, Render Cloud can ask LAN server for sync
        cloudSocket.on('cloud_request_lan_sync', () => {
            syncAllToCloud();
        });

        // When a remote teacher grades on Vercel or un-submits, forward to local sockets
        cloudSocket.on('grade_updated', (data) => {
            if (localIoRef) {
                localIoRef.emit('grade_updated', data);
            }
        });

        cloudSocket.on('teacher_student_unsubmitted', (data) => {
            if (localIoRef) {
                localIoRef.emit('teacher_student_unsubmitted', data);
                localIoRef.emit('student_unsubmitted', data);
            }
        });

        // Start 3-second heartbeat to ensure Vercel always has live active students
        if (!heartbeatTimer) {
            heartbeatTimer = setInterval(() => {
                if (isConnected && activeStudentsRef) {
                    syncAllToCloud();
                }
            }, 3000);
        }

    } catch (err) {
        console.warn('[Cloud Relay] Error starting cloud relay:', err.message);
    }
}

function syncAllToCloud() {
    if (!cloudSocket || !isConnected || !activeStudentsRef) return;
    for (const student of Object.values(activeStudentsRef)) {
        if (!student || student.isLive === false || student.status === 'Offline' || student.status === 'Submitted' || student.submitted) {
            continue;
        }
        cloudSocket.emit('student_typing', student);
    }
}

function relayStudentActivity(data) {
    if (!cloudSocket || !isConnected || !data) return;
    cloudSocket.emit('student_typing', data);
}

function relayProctorAlert(data) {
    if (!cloudSocket || !isConnected || !data) return;
    cloudSocket.emit('proctor_alert', data);
}

function relayTerminalUpdate(data) {
    if (!cloudSocket || !isConnected || !data) return;
    cloudSocket.emit('student_terminal_update', data);
}

function relayStudentLeft(data) {
    if (!cloudSocket || !isConnected || !data) return;
    cloudSocket.emit('teacher_student_left', data);
}

function relaySubmitExam(data) {
    if (!cloudSocket || !isConnected || !data) return;
    cloudSocket.emit('submit_exam', data);
}

function relayUnsubmitExam(data) {
    if (!cloudSocket || !isConnected || !data) return;
    cloudSocket.emit('unsubmit_exam', data);
}

module.exports = {
    initCloudRelay,
    relayStudentActivity,
    relayProctorAlert,
    relayTerminalUpdate,
    relayStudentLeft,
    relaySubmitExam,
    relayUnsubmitExam,
    syncAllToCloud
};
