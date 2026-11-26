import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import Skeleton from '../Skeleton';

export default function TeacherPeopleTab({
  isDark,
  styles,
  instructorInfo,
  classroom,
  currentUser,
  isClassroomArchivedState,
  allowManageStudents,
  setIsAddStudentOpen,
  enrolledStudents,
  sortedEnrolledStudents,
  loadingStudents,
  classCode
}) {
  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '40px' }}>
        <div style={styles.peopleSectionHeader}>
          <h2 style={styles.peopleSectionTitle}>Teachers</h2>
          <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '700' }}>1 instructor</span>
        </div>
        <div style={styles.peopleList}>
          <div style={styles.peopleRow}>
            {instructorInfo?.avatar ? (
              <img
                src={instructorInfo.avatar}
                alt={instructorInfo?.name || 'Instructor'}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                }}
              />
            ) : (
              <div style={styles.peopleAvatarGreen}>
                {(instructorInfo?.name || classroom?.instructor || currentUser?.name || 'I').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.95rem' }}>
                {instructorInfo?.name || classroom?.instructor || currentUser?.name || 'Instructor'}
              </div>
              {(instructorInfo?.email || classroom?.instructorEmail || (currentUser?.role === 'Teacher' ? currentUser?.email : '')) && (
                <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b' }}>
                  {instructorInfo?.email || classroom?.instructorEmail || (currentUser?.role === 'Teacher' ? currentUser?.email : '')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={styles.peopleSectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={styles.peopleSectionTitle}>Students</h2>
            {!isClassroomArchivedState && (currentUser?.role === 'Admin' || (currentUser?.role === 'Teacher' && allowManageStudents)) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsAddStudentOpen(true)}
                style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
              >
                + Add Student
              </motion.button>
            )}
          </div>
          <span style={{ fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#64748b', fontWeight: '600' }}>
            {enrolledStudents.length} student{enrolledStudents.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={styles.peopleList}>
          {loadingStudents ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton.Person key={i} isDark={isDark} />
              ))}
            </div>
          ) : enrolledStudents.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: isDark ? '#a3a3a3' : '#64748b' }}>
              <Users size={40} color={isDark ? '#4A4A4A' : '#cbd5e1'} style={{ margin: '0 auto 10px auto', display: 'block' }} />
              <p style={{ fontWeight: '600', margin: 0, color: isDark ? '#E8EAED' : '#1e293b' }}>No students enrolled yet</p>
              <p style={{ fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#94a3b8', margin: '4px 0 0 0' }}>
                Give students the class code <strong style={{ color: '#10b981' }}>{classCode}</strong> to join.
              </p>
            </div>
          ) : (
            sortedEnrolledStudents.map((student, idx) => (
              <div key={idx} style={styles.peopleRow}>
                {student.avatar ? (
                  <img
                    src={student.avatar}
                    alt={student.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}
                  />
                ) : (
                  <div style={styles.peopleAvatarBlue}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: '600', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.95rem' }}>
                    {student.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b' }}>
                    {student.email}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
