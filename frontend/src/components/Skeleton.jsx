import React from 'react';

/**
 * Skeleton — comprehensive shimmer placeholder components for loading states.
 *
 * Usage:
 *   <Skeleton.Card />           — classroom card (pill + rounded body)
 *   <Skeleton.Row />            — user/student list row with avatar and details
 *   <Skeleton.AssignmentRow />  — taller assignment pill row
 *   <Skeleton.StreamCard />     — stream feed announcement / assignment card
 *   <Skeleton.ActivityDetail /> — full student activity detail view
 *   <Skeleton.Calendar />       — 7-day calendar view
 *   <Skeleton.Settings />       — settings section card
 *   <Skeleton.Grading />        — teacher grading pane
 *   <Skeleton />                — raw block, pass width/height/borderRadius
 */

// Raw block
function Skeleton({ width = '100%', height = 16, borderRadius = 8, style = {}, className = '' }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ width, height, borderRadius, ...style }}
    />
  );
}

// Simple animated course card skeleton for home dashboards
Skeleton.CourseCard = function SkeletonCourseCard({ style = {} }) {
  return (
    <div
      className="skeleton-simple-card"
      style={{
        borderRadius: '20px',
        padding: '24px',
        minHeight: '240px',
        height: '260px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...style
      }}
    >
      <div>
        {/* Course title placeholder */}
        <div className="skeleton-shimmer" style={{ width: '68%', height: '22px', borderRadius: '8px' }} />
        {/* Section / subject line placeholder */}
        <div className="skeleton-shimmer" style={{ width: '40%', height: '14px', borderRadius: '6px', marginTop: '12px' }} />
      </div>

      {/* Bottom badge placeholder */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skeleton-shimmer" style={{ width: '90px', height: '24px', borderRadius: '9999px' }} />
        <div className="skeleton-shimmer" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
      </div>
    </div>
  );
};

Skeleton.Card = Skeleton.CourseCard;

// Todo item skeleton for dashboard sidebar
Skeleton.TodoItem = function SkeletonTodoItem({ style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', ...style }}>
      <div className="skeleton-shimmer" style={{ width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton-shimmer" style={{ width: '70%', height: '14px', borderRadius: '6px' }} />
        <div className="skeleton-shimmer" style={{ width: '40%', height: '12px', borderRadius: '4px' }} />
      </div>
    </div>
  );
};

// People tab clean roster row: avatar + name & email lines with bottom divider (no boxy pill background)
Skeleton.Person = function SkeletonPerson({ isDark, style = {} }) {
  return (
    <div
      className="skeleton-people-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 14px',
        borderBottom: isDark !== undefined
          ? (isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9')
          : undefined,
        ...style
      }}
    >
      {/* 40px circular avatar */}
      <div
        className="skeleton-shimmer"
        style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }}
      />
      {/* Name and email text lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <div
          className="skeleton-shimmer"
          style={{ width: '160px', height: '14px', borderRadius: '6px' }}
        />
        <div
          className="skeleton-shimmer"
          style={{ width: '220px', height: '11px', borderRadius: '4px' }}
        />
      </div>
    </div>
  );
};

Skeleton.PeopleRow = Skeleton.Person;

// Generic list row: avatar circle + two text lines + action pill
Skeleton.Row = function SkeletonRow({ cols = 7 }) {
  return (
    <div className="skeleton-row">
      {/* Avatar / checkbox placeholder */}
      <div className="skeleton-shimmer skeleton-avatar" />
      {/* Text group */}
      <div className="skeleton-text-group">
        <div className="skeleton-shimmer skeleton-text-line" style={{ width: '55%' }} />
        <div className="skeleton-shimmer skeleton-text-line" style={{ width: '35%' }} />
      </div>
      {/* Role pill */}
      <div className="skeleton-shimmer skeleton-action-pill" style={{ width: 50, marginRight: 4 }} />
      {/* Status pill */}
      <div className="skeleton-shimmer skeleton-action-pill" style={{ width: 54 }} />
    </div>
  );
};

// Assignment pill: full-width tall pill matching the assignment list style
Skeleton.AssignmentRow = function SkeletonAssignmentRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div
        className="skeleton-shimmer skeleton-assignment-pill"
        style={{ width: '100%' }}
      />
    </div>
  );
};

// Stream feed card: teacher avatar + date + body lines
Skeleton.StreamCard = function SkeletonStreamCard() {
  return (
    <div className="skeleton-stream-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="skeleton-shimmer skeleton-avatar" style={{ width: 38, height: 38 }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div className="skeleton-shimmer skeleton-text-line" style={{ width: '25%', height: 12 }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 4 }}>
        <div className="skeleton-shimmer skeleton-text-line" style={{ width: '92%', height: 12 }} />
        <div className="skeleton-shimmer skeleton-text-line" style={{ width: '78%', height: 12 }} />
      </div>
    </div>
  );
};

// Full activity detail page skeleton
Skeleton.ActivityDetail = function SkeletonActivityDetail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Back button placeholder */}
      <div className="skeleton-shimmer" style={{ width: '160px', height: '24px', borderRadius: '6px' }} />

      {/* Activity title pill */}
      <div className="skeleton-shimmer" style={{ width: '380px', height: '42px', borderRadius: '50px' }} />

      {/* Meta row: points and due date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="skeleton-shimmer" style={{ width: '120px', height: '18px', borderRadius: '4px' }} />
          <div className="skeleton-shimmer" style={{ width: '90px', height: '14px', borderRadius: '4px' }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: '80px', height: '20px', borderRadius: '6px' }} />
      </div>

      {/* Large instruction box */}
      <div
        className="skeleton-shimmer"
        style={{ width: '100%', height: '240px', borderRadius: '24px' }}
      />

      {/* Bottom action buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '16px' }}>
        <div className="skeleton-shimmer" style={{ width: '140px', height: '46px', borderRadius: '50px' }} />
        <div className="skeleton-shimmer" style={{ width: '140px', height: '46px', borderRadius: '50px' }} />
      </div>
    </div>
  );
};

// Weekly calendar skeleton
Skeleton.Calendar = function SkeletonCalendar() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: '100%' }}>
      {/* Header controls: dropdown + week navigator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skeleton-shimmer" style={{ width: '220px', height: '42px', borderRadius: '8px' }} />
        <div className="skeleton-shimmer" style={{ width: '240px', height: '36px', borderRadius: '8px' }} />
        <div style={{ width: '220px' }} />
      </div>

      {/* 7-column calendar grid */}
      <div className="skeleton-calendar-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton-calendar-col">
            {/* Day name */}
            <div className="skeleton-shimmer" style={{ width: '40px', height: '12px', margin: '0 auto', borderRadius: '4px' }} />
            {/* Date circle */}
            <div className="skeleton-shimmer" style={{ width: '32px', height: '32px', borderRadius: '50%', margin: '0 auto' }} />
            {/* Event pill placeholder */}
            {i % 2 === 0 && (
              <div className="skeleton-shimmer" style={{ width: '100%', height: '54px', borderRadius: '6px', marginTop: '12px' }} />
            )}
            {i === 3 && (
              <div className="skeleton-shimmer" style={{ width: '100%', height: '54px', borderRadius: '6px', marginTop: '6px' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Settings section card skeleton
Skeleton.Settings = function SkeletonSettings() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '720px' }}>
      {/* Header icon + titles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="skeleton-shimmer" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <div className="skeleton-shimmer" style={{ width: '200px', height: '22px', borderRadius: '6px' }} />
          <div className="skeleton-shimmer" style={{ width: '360px', height: '14px', borderRadius: '4px' }} />
        </div>
      </div>

      {/* Form inputs grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="skeleton-shimmer" style={{ width: '90px', height: '12px', borderRadius: '4px' }} />
            <div className="skeleton-shimmer" style={{ width: '100%', height: '44px', borderRadius: '12px' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Grading view skeleton: realistic 2-column grading workspace with student submission list, code preview, and score controls
Skeleton.Grading = function SkeletonGrading({ isDark = false, isMobile = false, showActivitySelector = false, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', ...style }}>
      {/* Activity selector dropdown placeholder */}
      {showActivitySelector && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton-shimmer" style={{ width: '60px', height: '14px', borderRadius: '4px' }} />
          <div className="skeleton-shimmer" style={{ width: '280px', height: '38px', borderRadius: '9999px' }} />
        </div>
      )}

      {/* Two-column workspace */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '24px',
        alignItems: 'flex-start',
        width: '100%'
      }}>
        {/* Left pane: Student submissions roster */}
        <div style={{
          width: isMobile ? '100%' : '280px',
          flexShrink: 0,
          borderRadius: '12px',
          border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
          overflow: 'hidden',
          backgroundColor: isDark ? '#262626' : '#ffffff',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 14px',
            borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
            backgroundColor: isDark ? '#222222' : '#f8fafc'
          }}>
            <div className="skeleton-shimmer" style={{ width: '100px', height: '14px', borderRadius: '4px' }} />
          </div>

          {/* Student rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: i < 4 ? (isDark ? '1px solid #383838' : '1px solid #f1f5f9') : 'none',
                  backgroundColor: i === 0
                    ? (isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4')
                    : 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    className="skeleton-shimmer"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }}
                  />
                  <div
                    className="skeleton-shimmer"
                    style={{ width: i === 0 ? '90px' : (i % 2 === 0 ? '110px' : '80px'), height: '13px', borderRadius: '4px' }}
                  />
                </div>
                <div
                  className="skeleton-shimmer"
                  style={{ width: '56px', height: '20px', borderRadius: '6px', flexShrink: 0 }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right pane: Evaluation & Code Desk */}
        <div style={{
          flex: 1,
          width: isMobile ? '100%' : 'auto',
          borderRadius: '12px',
          border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
          backgroundColor: isDark ? '#262626' : '#ffffff',
          padding: '20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Header with Student name + Playback button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '14px',
            borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="skeleton-shimmer" style={{ width: '150px', height: '20px', borderRadius: '6px' }} />
              <div className="skeleton-shimmer" style={{ width: '110px', height: '12px', borderRadius: '4px' }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: '94px', height: '32px', borderRadius: '8px' }} />
          </div>

          {/* Submitted Code label */}
          <div className="skeleton-shimmer" style={{ width: '110px', height: '12px', borderRadius: '4px' }} />

          {/* Code preview block */}
          <div style={{
            backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
            border: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minHeight: '200px'
          }}>
            <div className="skeleton-shimmer" style={{ width: '30%', height: '12px', borderRadius: '4px' }} />
            <div className="skeleton-shimmer" style={{ width: '60%', height: '12px', borderRadius: '4px' }} />
            <div className="skeleton-shimmer" style={{ width: '85%', height: '12px', borderRadius: '4px', marginLeft: '16px' }} />
            <div className="skeleton-shimmer" style={{ width: '55%', height: '12px', borderRadius: '4px', marginLeft: '16px' }} />
            <div className="skeleton-shimmer" style={{ width: '70%', height: '12px', borderRadius: '4px', marginLeft: '16px' }} />
            <div className="skeleton-shimmer" style={{ width: '40%', height: '12px', borderRadius: '4px' }} />
            <div className="skeleton-shimmer" style={{ width: '20%', height: '12px', borderRadius: '4px' }} />
          </div>

          {/* Bottom Controls: Grade score input + Feedback + Return button */}
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
            paddingTop: '8px'
          }}>
            <div className="skeleton-shimmer" style={{ width: '120px', height: '40px', borderRadius: '8px' }} />
            <div className="skeleton-shimmer" style={{ flex: 1, minWidth: '180px', height: '40px', borderRadius: '8px' }} />
            <div className="skeleton-shimmer" style={{ width: '110px', height: '40px', borderRadius: '8px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
