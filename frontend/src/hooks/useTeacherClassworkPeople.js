import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../data/api';

export function useTeacherClassworkPeople({ classroom, currentUser, socket, classCode }) {
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [refreshStudentsKey, setRefreshStudentsKey] = useState(0);

  const [instructorInfo, setInstructorInfo] = useState({
    name: classroom?.instructor || (currentUser?.role === 'Teacher' ? currentUser.name : ''),
    email:
      classroom?.instructorEmail ||
      classroom?.instructor_email ||
      (currentUser?.role === 'Teacher' ? currentUser.email : ''),
    avatar: currentUser?.role === 'Teacher' && currentUser?.avatar ? currentUser.avatar : null
  });

  const sortedEnrolledStudents = useMemo(() => {
    return [...enrolledStudents].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }, [enrolledStudents]);

  const [prevPeopleClassId, setPrevPeopleClassId] = useState(null);
  const peopleSyncKey = `${classroom?.id ?? ''}|${refreshStudentsKey}`;
  if (classroom?.id && peopleSyncKey !== prevPeopleClassId) {
    setPrevPeopleClassId(peopleSyncKey);
    setLoadingStudents(true);
  }

  useEffect(() => {
    if (!classroom?.id) return;

    const loadStudents = async () => {
      const studentsMap = {};

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('verity_student_classrooms_')) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const match = list.some(
                  (c) =>
                    c.id === classroom.id ||
                    (c.code && c.code.toLowerCase() === classCode.toLowerCase()) ||
                    (c.section && c.section.toLowerCase() === (classroom.section || '').toLowerCase())
                );
                if (match) {
                  const studentName = k.replace('verity_student_classrooms_', '');
                  studentsMap[studentName.toLowerCase()] = {
                    name: studentName,
                    email: `${studentName.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
                    avatar: null
                  };
                }
              }
            }
          }
        }
      } catch {}

      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classroom-students/${classroom.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.instructor && data.instructor.name) {
            setInstructorInfo({
              name: data.instructor.name,
              email: data.instructor.email || '',
              avatar:
                data.instructor.avatar ||
                (currentUser?.role === 'Teacher' && currentUser?.avatar ? currentUser.avatar : null)
            });
          }
          if (Array.isArray(data.students)) {
            data.students.forEach((s) => {
              if (s && s.name) {
                studentsMap[s.name.toLowerCase()] = {
                  name: s.name,
                  email: s.email || `${s.name.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
                  avatar: s.avatar || null
                };
              }
            });
          }
        }
      } catch {}

      // Check explicit local enrollments
      try {
        const localKey = `verity_classroom_enrollments_${classroom.id}`;
        const rawLocal = localStorage.getItem(localKey);
        if (rawLocal) {
          const arr = JSON.parse(rawLocal);
          if (Array.isArray(arr)) {
            arr.forEach((s) => {
              if (s && s.name) {
                studentsMap[s.name.toLowerCase()] = {
                  name: s.name,
                  email: s.email || `${s.name.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
                  avatar: s.avatar || studentsMap[s.name.toLowerCase()]?.avatar || null
                };
              }
            });
          }
        }
      } catch {}

      const sortedStudents = Object.values(studentsMap).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
      );
      setEnrolledStudents(sortedStudents);
      setLoadingStudents(false);
    };

    loadStudents();

    const handleAvatarBroadcast = (data) => {
      if (!data) return;
      setInstructorInfo((prev) => {
        if (
          prev &&
          ((data.email && prev.email && data.email.toLowerCase() === prev.email.toLowerCase()) ||
            (data.name && prev.name && data.name.toLowerCase() === prev.name.toLowerCase()))
        ) {
          return { ...prev, avatar: data.avatar };
        }
        return prev;
      });

      setEnrolledStudents((prev) =>
        prev.map((s) => {
          if (
            (data.email && s.email && data.email.toLowerCase() === data.email.toLowerCase()) ||
            (data.name && s.name && data.name.toLowerCase() === data.name.toLowerCase())
          ) {
            return { ...s, avatar: data.avatar };
          }
          return s;
        })
      );
    };

    if (socket) {
      socket.on('user_avatar_updated', handleAvatarBroadcast);
    }

    return () => {
      if (socket) {
        socket.off('user_avatar_updated', handleAvatarBroadcast);
      }
    };
  }, [classroom?.id, classCode, classroom?.section, socket, currentUser, refreshStudentsKey]);

  return {
    enrolledStudents,
    sortedEnrolledStudents,
    loadingStudents,
    isAddStudentOpen,
    setIsAddStudentOpen,
    refreshStudentsKey,
    setRefreshStudentsKey,
    instructorInfo
  };
}
