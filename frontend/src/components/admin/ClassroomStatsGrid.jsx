
export default function ClassroomStatsGrid({
  totalClasses,
  totalActive,
  registeredStudentsCount,
  instructorsCount,
  styles
}) {
  return (
    <div style={styles.statsGrid}>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Total Class</div>
        <div style={styles.statNum}>{totalClasses || 0}</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Active Classrooms</div>
        <div style={styles.statNum}>{totalActive || 0}</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Registered Students</div>
        <div style={styles.statNum}>{registeredStudentsCount || 0}</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Instructors</div>
        <div style={styles.statNum}>{instructorsCount || 0}</div>
      </div>
    </div>
  );
}
