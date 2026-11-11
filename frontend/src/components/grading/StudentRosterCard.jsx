import React from 'react';
import { Users, Sparkles, Check, Search, X, AlertCircle } from 'lucide-react';
import { isStudentGraded, getStudentGrade } from '../../utils/gradeUtils';
import { formatShortDate } from '../../utils/dateUtils';

export default function StudentRosterCard({
  students,
  filteredStudents,
  selectedId,
  setSelectedId,
  grades,
  maxPoints,
  searchTerm,
  setSearchTerm,
  filterTab,
  setFilterTab,
  turnedInCount,
  ungradedCount,
  gradedCount,
  onOpenBulkModal,
  bulkSuccessMsg,
  isDark,
  styles
}) {
  return (
    <div style={styles.rosterCard}>
      <div style={styles.rosterHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#10b981" />
            <h3 style={styles.rosterTitle}>Class Roster</h3>
            <span style={styles.rosterCountBadge}>{filteredStudents.length}</span>
          </div>

          {turnedInCount > 0 && (
            <button
              onClick={onOpenBulkModal}
              style={styles.bulkGradeBtn}
              className="btn-anim"
              title="Grade all turned in students in one click"
            >
              <Sparkles size={14} /> Grade All
            </button>
          )}
        </div>

        {bulkSuccessMsg && (
          <div style={styles.bulkToast}>
            <Check size={14} /> {bulkSuccessMsg}
          </div>
        )}

        {/* Filter Pills */}
        <div style={styles.filterPillsRow}>
          {[
            { id: 'all', label: `All (${students.length})` },
            { id: 'ungraded', label: `Ungraded (${ungradedCount})` },
            { id: 'graded', label: `Graded (${gradedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              style={styles.filterPillBtn(filterTab === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={styles.searchWrapper}>
          <Search size={14} color={isDark ? '#94a3b8' : '#64748b'} />
          <input
            type="text"
            placeholder="Search student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={styles.clearSearchBtn}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Student List */}
      <div style={styles.studentList}>
        {filteredStudents.length === 0 ? (
          <div style={styles.emptyRoster}>
            <AlertCircle size={32} color={isDark ? '#4b5563' : '#cbd5e1'} style={{ margin: '0 auto 8px auto' }} />
            <p style={{ margin: 0, fontWeight: '600', color: isDark ? '#e2e8f0' : '#334155' }}>
              {searchTerm ? 'No matching students' : 'No Submissions Yet'}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' }}>
              {searchTerm ? 'Try adjusting your search filter' : 'Students will appear in this roster once they submit their work.'}
            </p>
          </div>
        ) : (
          filteredStudents.map(student => {
            const isSelected = selectedId === student.id;
            const isGrad = isStudentGraded(grades, student);
            const curGrade = getStudentGrade(grades, student);

            return (
              <div
                key={student.id}
                onClick={() => setSelectedId(student.id)}
                style={styles.studentRow(isSelected)}
                className="btn-anim"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={styles.studentAvatar(isGrad ? 'graded' : 'turned_in')}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.studentRowName(isSelected)}>
                      {student.name}
                    </div>
                    <div style={styles.studentRowSub}>
                      {student.submittedAt ? `Turned in ${formatShortDate(student.submittedAt)}` : 'Turned In'}
                    </div>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {isGrad ? (
                    <span style={styles.statusBadgeGraded}>
                      <Check size={11} strokeWidth={3} /> {curGrade?.grade ?? maxPoints}/{maxPoints}
                    </span>
                  ) : (
                    <span style={styles.statusBadgeTurnedIn}>
                      Turned In
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
