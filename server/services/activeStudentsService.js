const {
    initCloudRelay,
    relayStudentActivity,
    relayProctorAlert,
    relayTerminalUpdate,
    relayStudentLeft,
    relaySubmitExam,
    relayUnsubmitExam
} = require('../cloudRelay');

/**
 * Tracks live student coding sessions across classrooms and activities,
 * broadcasts live activity badges, and coordinates cloud relay forwarding.
 */
function createActiveStudentsService({ io }) {
    const activeStudents = {};
    initCloudRelay(activeStudents, io);

    function getActiveActivitiesMap(targetClassroomId = null) {
        const counts = {};
        const targetLower = targetClassroomId && targetClassroomId !== 'all' ? String(targetClassroomId).toLowerCase() : null;
        for (const student of Object.values(activeStudents)) {
            if (!student || !student.assignmentId || student.assignmentId === 'none' || student.assignmentId === 'unassigned') continue;
            if (student.isLive === false || student.status === 'Offline' || student.status === 'Submitted') continue;
            if (targetLower && student.classroomId && student.classroomId !== 'none') {
                // Included by unique assignmentId even when classroom representations differ
            }
            const aId = String(student.assignmentId);
            counts[aId] = (counts[aId] || 0) + 1;
        }
        return counts;
    }

    function getActiveClassroomsMap() {
        const classroomCounts = {};
        for (const student of Object.values(activeStudents)) {
            if (!student || !student.assignmentId || student.assignmentId === 'none' || student.assignmentId === 'unassigned') continue;
            if (student.isLive === false || student.status === 'Offline' || student.status === 'Submitted') continue;
            if (student.classroomId && student.classroomId !== 'none' && student.classroomId !== 'unassigned') {
                const cId = String(student.classroomId);
                classroomCounts[cId] = (classroomCounts[cId] || 0) + 1;
                classroomCounts[cId.toLowerCase()] = (classroomCounts[cId.toLowerCase()] || 0) + 1;
                if (student.classCode) {
                    const code = String(student.classCode);
                    classroomCounts[code] = (classroomCounts[code] || 0) + 1;
                    classroomCounts[code.toLowerCase()] = (classroomCounts[code.toLowerCase()] || 0) + 1;
                }
            }
        }
        return classroomCounts;
    }

    function broadcastActiveActivities() {
        const allCounts = {};
        const classroomCounts = getActiveClassroomsMap();
        for (const student of Object.values(activeStudents)) {
            if (!student || !student.assignmentId || student.assignmentId === 'none' || student.assignmentId === 'unassigned') continue;
            if (student.isLive === false || student.status === 'Offline' || student.status === 'Submitted') continue;
            const aId = String(student.assignmentId);
            allCounts[aId] = (allCounts[aId] || 0) + 1;
        }
        io.emit('active_activities_update', { counts: allCounts, classroomCounts });
    }

    function removeStudentFromPreviousActivities(studentId, studentName, excludeKey = null) {
        const sIdStr = String(studentId || '');
        const sNameStr = String(studentName || '').trim().toLowerCase();
        const removedRooms = [];

        for (const [key, student] of Object.entries(activeStudents)) {
            if (key === excludeKey) continue;
            if (!student) continue;

            const curId = String(student.studentId || student.id || '');
            const curName = String(student.name || student.studentName || '').trim().toLowerCase();

            const isMatch = (sIdStr && curId === sIdStr) || (sNameStr && curName === sNameStr);
            if (isMatch) {
                removedRooms.push({
                    key,
                    classroomId: student.classroomId,
                    assignmentId: student.assignmentId,
                    studentId: student.studentId || studentId,
                    studentName: student.name || studentName
                });
                delete activeStudents[key];
            }
        }

        for (const item of removedRooms) {
            const roomName = `classroom:${item.classroomId}:assignment:${item.assignmentId}`;
            const payload = {
                studentId: item.studentId,
                studentName: item.studentName,
                classroomId: item.classroomId,
                assignmentId: item.assignmentId,
                reason: 'switched_activity'
            };
            io.to(roomName).emit('teacher_student_left', payload);
            io.emit('teacher_student_left', payload);
        }

        if (removedRooms.length > 0) {
            broadcastActiveActivities();
        }
    }

    return {
        activeStudents,
        getActiveActivitiesMap,
        getActiveClassroomsMap,
        broadcastActiveActivities,
        removeStudentFromPreviousActivities,
        relayStudentActivity,
        relayProctorAlert,
        relayTerminalUpdate,
        relayStudentLeft,
        relaySubmitExam,
        relayUnsubmitExam
    };
}

module.exports = { createActiveStudentsService };
