import React from 'react';

export default function ClassGradingSection({ grading, setGrading, isDark, styles }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Grading</h2>

      <div style={styles.subSection}>
        <h3 style={styles.subSectionTitle}>Draft grade for missing assignments</h3>
        <p style={styles.paragraph}>
          When a student hasn't turned in their submission by the due date, or you have marked the submission as missing, it will automatically receive a draft grade. Students won't see this grade until you return it.
        </p>

        <div style={styles.rowItem}>
          <div style={styles.rowLabel}>Automatically apply a draft grade to Missing assignments</div>
          <label style={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={grading.autoDraftGrade}
              onChange={(e) => setGrading({ ...grading, autoDraftGrade: e.target.checked })}
              style={styles.toggleInput}
            />
            <div style={grading.autoDraftGrade ? styles.toggleSliderActive : styles.toggleSlider}>
              <div style={grading.autoDraftGrade ? styles.toggleCircleActive : styles.toggleCircle}></div>
            </div>
          </label>
        </div>

        {grading.autoDraftGrade && (
          <div style={{ ...styles.inputWrapper, width: '150px', marginTop: '15px' }}>
            <label style={styles.floatingLabel}>Default grade</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="number"
                style={{ ...styles.input, borderBottom: 'none' }}
                value={grading.defaultGrade}
                onChange={(e) => setGrading({ ...grading, defaultGrade: e.target.value })}
              />
              <span style={{ paddingRight: '15px', color: isDark ? '#9ca3af' : '#5f6368' }}>%</span>
            </div>
            <div style={{ height: '2px', backgroundColor: isDark ? '#10b981' : '#1a73e8', width: '100%' }}></div>
          </div>
        )}
      </div>

      <div style={styles.divider} />

      <div style={styles.subSection}>
        <h3 style={styles.subSectionTitle}>Grade calculation</h3>

        <div style={styles.rowItem}>
          <div>
            <div style={styles.rowLabel}>Overall grade calculation</div>
            <div style={styles.rowDesc}>
              Choose a grading system. <span style={styles.linkText}>Learn more</span>
            </div>
          </div>
          <select
            style={styles.selectBox}
            value={grading.overallCalculation}
            onChange={(e) => setGrading({ ...grading, overallCalculation: e.target.value })}
          >
            <option style={styles.option}>No overall grade</option>
            <option style={styles.option}>Total points</option>
            <option style={styles.option}>Weighted by category</option>
          </select>
        </div>

        <div style={styles.rowItem}>
          <div style={styles.rowLabel}>Show overall grade to students</div>
          <label style={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={grading.showOverallToStudents}
              onChange={(e) => setGrading({ ...grading, showOverallToStudents: e.target.checked })}
              style={styles.toggleInput}
              disabled={grading.overallCalculation === 'No overall grade'}
            />
            <div
              style={
                grading.showOverallToStudents
                  ? styles.toggleSliderActive
                  : grading.overallCalculation === 'No overall grade'
                  ? styles.toggleSliderDisabled
                  : styles.toggleSlider
              }
            >
              <div style={grading.showOverallToStudents ? styles.toggleCircleActive : styles.toggleCircle}></div>
            </div>
          </label>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.subSection}>
        <h3 style={styles.subSectionTitle}>Grade categories</h3>
        <div style={{ ...styles.linkText, marginTop: '10px', fontSize: '0.9rem', fontWeight: '500' }}>
          Add grade category
        </div>
      </div>
    </div>
  );
}

