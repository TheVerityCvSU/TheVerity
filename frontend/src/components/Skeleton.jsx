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

// Classroom card: pill label on top + card body beneath
Skeleton.Card = function SkeletonCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Pill */}
      <div className="skeleton-shimmer skeleton-card-pill" />
      {/* Card body */}
      <div className="skeleton-shimmer skeleton-card-body" />
    </div>
  );
};

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

// Grading view skeleton
Skeleton.Grading = function SkeletonGrading() {
  return (
    <div style={{ display: 'flex', gap: '24px', width: '100%', height: '100%' }}>
      {/* Student list pane */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="skeleton-shimmer" style={{ width: '100%', height: '42px', borderRadius: '10px' }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer" style={{ width: '100%', height: '56px', borderRadius: '12px' }} />
        ))}
      </div>

      {/* Code preview & feedback pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="skeleton-shimmer" style={{ width: '100%', height: '50px', borderRadius: '12px' }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: '360px', borderRadius: '16px' }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: '80px', borderRadius: '12px' }} />
      </div>
    </div>
  );
};

// Full student activity detail wrapper
Skeleton.StudentActivityDetail = function SkeletonStudentActivityDetail() {
  return (
    <div style={{ minHeight: '100vh', padding: '32px clamp(20px, 3vw, 48px)', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <Skeleton.ActivityDetail />
    </div>
  );
};

// Full teacher grading wrapper
Skeleton.GradingContainer = function SkeletonGradingContainer() {
  return (
    <div style={{ minHeight: '100vh', padding: '24px clamp(16px, 2.5vw, 36px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div className="skeleton-shimmer" style={{ width: 220, height: 26, borderRadius: 8 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 100, height: 36, borderRadius: 18 }} />
      </div>
      <div style={{ flex: 1, minHeight: 460 }}>
        <Skeleton.Grading />
      </div>
    </div>
  );
};

// Auth / Login form skeleton
Skeleton.AuthForm = function SkeletonAuthForm() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '36px',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
          <div className="skeleton-shimmer" style={{ width: 64, height: 64, borderRadius: '50%' }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: '60%', height: 24, margin: '0 auto', borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: '80%', height: 14, margin: '0 auto', borderRadius: 4 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
          <div className="skeleton-shimmer" style={{ width: '100%', height: 48, borderRadius: 14 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 48, borderRadius: 14 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 48, borderRadius: 14, marginTop: '8px' }} />
        </div>
      </div>
    </div>
  );
};

// Full Student Dashboard Route Skeleton
Skeleton.StudentDashboard = function SkeletonStudentDashboard() {
  return (
    <div style={{ minHeight: '100vh', padding: '32px clamp(20px, 3vw, 48px)', display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: 140, height: 26, borderRadius: 8 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton-shimmer" style={{ width: 90, height: 36, borderRadius: 20 }} />
          <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        </div>
      </div>

      {/* Main content grid: Courses on left + ToDo on right */}
      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', width: '100%' }}>
        {/* Enrolled Courses */}
        <div style={{ flex: '1 1 0%', minWidth: 280, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="skeleton-shimmer" style={{ width: 180, height: 28, borderRadius: 8 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            <Skeleton.Card />
            <Skeleton.Card />
            <Skeleton.Card />
            <Skeleton.Card />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 340, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="skeleton-shimmer" style={{ width: 150, height: 28, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 140, borderRadius: 18 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton.AssignmentRow />
            <Skeleton.AssignmentRow />
            <Skeleton.AssignmentRow />
          </div>
        </div>
      </div>
    </div>
  );
};

// Full Student Classroom View Route Skeleton
Skeleton.ClassroomView = function SkeletonClassroomView() {
  return (
    <div style={{ minHeight: '100vh', padding: '24px clamp(16px, 2.5vw, 36px)', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div className="skeleton-shimmer" style={{ width: 220, height: 28, borderRadius: 8 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      </div>

      {/* Hero Banner */}
      <div className="skeleton-shimmer" style={{ width: '100%', height: 160, borderRadius: 24 }} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(125, 125, 125, 0.15)', paddingBottom: '12px' }}>
        <div className="skeleton-shimmer" style={{ width: 90, height: 36, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ width: 100, height: 36, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ width: 95, height: 36, borderRadius: 20 }} />
      </div>

      {/* Content items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
        <Skeleton.AssignmentRow />
        <Skeleton.AssignmentRow />
        <Skeleton.AssignmentRow />
        <Skeleton.AssignmentRow />
      </div>
    </div>
  );
};

// Full Student / Sandbox Workspace Route Skeleton
Skeleton.Workspace = function SkeletonWorkspace() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
      {/* Workspace Header */}
      <div style={{
        height: 56,
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(125, 125, 125, 0.2)',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 180, height: 20, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton-shimmer" style={{ width: 90, height: 34, borderRadius: 18 }} />
          <div className="skeleton-shimmer" style={{ width: 110, height: 34, borderRadius: 18 }} />
        </div>
      </div>

      {/* Workspace Split Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor Pane (Left) */}
        <div style={{ flex: 1.2, padding: '20px', display: 'flex', gap: '16px', borderRight: '1px solid rgba(125, 125, 125, 0.2)', boxSizing: 'border-box' }}>
          {/* Line Numbers Gutter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: 28 }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer" style={{ width: 20, height: 14, borderRadius: 4 }} />
            ))}
          </div>
          {/* Code Lines */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="skeleton-shimmer" style={{ width: '45%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '70%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '30%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '85%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '60%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '50%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '75%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '40%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: '65%', height: 14, borderRadius: 4 }} />
          </div>
        </div>

        {/* Panel Pane (Right) */}
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="skeleton-shimmer" style={{ width: 100, height: 32, borderRadius: 16 }} />
            <div className="skeleton-shimmer" style={{ width: 80, height: 32, borderRadius: 16 }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: '100%', flex: 1, borderRadius: 16 }} />
        </div>
      </div>
    </div>
  );
};

// Full Teacher Dashboard Route Skeleton
Skeleton.TeacherDashboard = function SkeletonTeacherDashboard() {
  return (
    <div style={{ minHeight: '100vh', padding: '32px clamp(20px, 3vw, 48px)', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', boxSizing: 'border-box' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: 160, height: 26, borderRadius: 8 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="skeleton-shimmer" style={{ width: 130, height: 40, borderRadius: 20 }} />
          <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        </div>
      </div>

      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skeleton-shimmer" style={{ width: 160, height: 28, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 220, height: 36, borderRadius: 20 }} />
      </div>

      {/* Classrooms Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        <Skeleton.Card />
        <Skeleton.Card />
        <Skeleton.Card />
        <Skeleton.Card />
      </div>
    </div>
  );
};

// Full Teacher Classwork Route Skeleton
Skeleton.TeacherClasswork = function SkeletonTeacherClasswork() {
  return (
    <div style={{ minHeight: '100vh', padding: '24px clamp(16px, 2.5vw, 36px)', display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div className="skeleton-shimmer" style={{ width: 240, height: 28, borderRadius: 8 }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="skeleton-shimmer" style={{ width: 120, height: 38, borderRadius: 20 }} />
          <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: '50%' }} />
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid rgba(125, 125, 125, 0.15)', paddingBottom: '12px' }}>
        <div className="skeleton-shimmer" style={{ width: 80, height: 34, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ width: 95, height: 34, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ width: 90, height: 34, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ width: 75, height: 34, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ width: 85, height: 34, borderRadius: 20 }} />
      </div>

      {/* Feed / Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton.AssignmentRow />
        <Skeleton.AssignmentRow />
        <Skeleton.AssignmentRow />
        <Skeleton.AssignmentRow />
      </div>
    </div>
  );
};

// Full Teacher Monitoring / Proctoring / Playback Route Skeleton
Skeleton.TeacherMonitoring = function SkeletonTeacherMonitoring() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
      {/* Top Header */}
      <div style={{ height: 60, padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(125, 125, 125, 0.2)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 200, height: 22, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="skeleton-shimmer" style={{ width: 110, height: 36, borderRadius: 18 }} />
          <div className="skeleton-shimmer" style={{ width: 90, height: 36, borderRadius: 18 }} />
        </div>
      </div>

      {/* Streams Grid */}
      <div style={{ flex: 1, padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', boxSizing: 'border-box' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton-shimmer" style={{ width: '100%', height: 220, borderRadius: 16 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="skeleton-shimmer" style={{ width: 120, height: 16, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: 60, height: 20, borderRadius: 10 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Full Admin Dashboard Route Skeleton
Skeleton.AdminDashboard = function SkeletonAdminDashboard() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
      {/* Admin Top Header */}
      <div style={{ height: 64, padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(125, 125, 125, 0.2)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 130, height: 22, borderRadius: 6 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 320, height: 38, borderRadius: 20 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div className="skeleton-shimmer" style={{ width: 110, height: 36, borderRadius: 18 }} />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        {/* Left Sidebar */}
        <div style={{ width: 220, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderRight: '1px solid rgba(125, 125, 125, 0.2)', boxSizing: 'border-box' }}>
          <div className="skeleton-shimmer" style={{ width: '100%', height: 42, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 42, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 42, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 42, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 42, borderRadius: 12 }} />
        </div>

        {/* Main Content Pane */}
        <div style={{ flex: 1, padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
          {/* Stats 4-Card Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 100, borderRadius: 16 }} />
            ))}
          </div>

          {/* Table Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <div className="skeleton-shimmer" style={{ width: 280, height: 40, borderRadius: 20 }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="skeleton-shimmer" style={{ width: 110, height: 40, borderRadius: 20 }} />
              <div className="skeleton-shimmer" style={{ width: 110, height: 40, borderRadius: 20 }} />
            </div>
          </div>

          {/* Table Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton.Row key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
