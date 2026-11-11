import React from 'react';
import { ArrowLeft, BookOpen, Calendar, Award, FileText, Video, Link2, ClipboardList } from 'lucide-react';
import AttachmentCard from '../AttachmentCard';
import ActivitySubmissionSection from './ActivitySubmissionSection';
import { formatFullDate } from '../../utils/dateUtils';

export default function ActivityContentCard({
  assignment,
  classroom,
  isDark,
  styles,
  submission,
  gradeData,
  isSubmitted,
  onSubmit,
  onUnsubmit,
  onStartCoding,
  onViewCode,
  onPreviewAttachment,
  onPreviewLink,
  onBack
}) {
  const isMaterial = assignment?.activityType === 'Material';
  const lessonType = isMaterial ? (
    assignment?.attachments?.some(a => a?.type?.toLowerCase()?.includes('video') || a?.type === 'youtube') ? 'video' :
    assignment?.attachments?.some(a => a?.type?.toLowerCase()?.includes('link') || a?.type === 'url') ? 'link' :
    'document'
  ) : null;

  const pointsText = assignment?.points ? `${assignment.points} points` : '100 points';
  const dueDateText = assignment?.dueDate ? `Due : ${assignment.dueDate}` : 'No due date';
  const title = assignment?.title || (isMaterial ? "Material Details" : "Activity Details");
  const details = assignment?.details || assignment?.description || (isMaterial ? "No description provided for this material." : "No instructions provided for this activity.");

  const handleBackToClassroom = () => {
    if (isMaterial) {
      try {
        if (classroom?.id) sessionStorage.setItem(`verity_student_classroom_tab_${classroom.id}`, 'materials');
        sessionStorage.setItem('verity_student_classroom_tab_active', 'materials');
        sessionStorage.setItem(`verity_student_tab_${classroom?.id}`, 'materials');
        sessionStorage.setItem('verity_student_tab_active', 'materials');
      } catch (_) {}
    }
    if (onBack) onBack();
  };

  const handleInstructionClick = (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      e.stopPropagation();
      onPreviewLink({
        url: anchor.href,
        name: anchor.innerText?.trim() || anchor.href,
        type: 'link'
      });
    }
  };

  return (
    <div style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Row */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={handleBackToClassroom} style={styles.backBtn}>
          <ArrowLeft size={16} style={{ marginRight: '6px' }} /> {isMaterial ? 'Back to Materials' : 'Back to Activities'}
        </button>
      </div>

      {/* Main Dark Card */}
      <div style={{ 
        backgroundColor: isDark ? '#2E2E2E' : '#ffffff', 
        borderRadius: '16px', 
        border: isDark ? '1px solid #484848' : '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.4)' : '0 10px 30px rgba(0,0,0,0.04)'
      }}>
        {/* Banner Header */}
        <div style={{ 
          background: isDark ? '#262626' : '#f8fafc',
          padding: '40px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: isDark ? '1px solid #484848' : '1px solid #e2e8f0'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: isMaterial
              ? (lessonType === 'video' ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7') : lessonType === 'link' ? (isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe') : (isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5'))
              : (isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5'),
            border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isMaterial
              ? (lessonType === 'video' ? (isDark ? '#fbbf24' : '#d97706') : lessonType === 'link' ? (isDark ? '#38bdf8' : '#0284c7') : '#10b981')
              : '#10b981',
            flexShrink: 0
          }}>
            {isMaterial ? (
              lessonType === 'video' ? <Video size={28} /> : lessonType === 'link' ? <Link2 size={28} /> : <FileText size={28} />
            ) : (
              <ClipboardList size={28} />
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {isMaterial ? 'MATERIAL DETAILS' : 'ACTIVITY DETAILS'}
            </span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 'bold', color: isDark ? 'white' : '#0f172a', margin: 0, lineHeight: 1.1, wordBreak: 'break-word' }}>
              {title}
            </h1>
          </div>
        </div>

        {/* Meta Strip */}
        <div style={{ 
          backgroundColor: isDark ? '#262626' : '#ffffff', 
          borderBottom: isDark ? '1px solid #484848' : '1px solid #e2e8f0',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
          flexWrap: 'wrap'
        }}>
          {isMaterial ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BookOpen size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Topic</span>
                  <span style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 'bold' }}>{assignment?.topic || 'Course Material'}</span>
                </div>
              </div>

              <div style={{ width: '1px', height: '28px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5', padding: '6px', borderRadius: '8px', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Posted</span>
                  <span style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 'bold' }}>{assignment?.posted || formatFullDate(assignment?.id)}</span>
                </div>
              </div>

              {assignment?.attachments?.length > 0 && (
                <>
                  <div style={{ width: '1px', height: '28px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Resources</span>
                      <span style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 'bold' }}>
                        {assignment.attachments.length} attachment{assignment.attachments.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Award size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Points</span>
                  <span style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 'bold' }}>{pointsText}</span>
                </div>
              </div>
              
              <div style={{ width: '1px', height: '28px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5', padding: '6px', borderRadius: '8px', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Due</span>
                  <span style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 'bold' }}>{dueDateText === 'No Due Date' ? 'No Due Date' : dueDateText}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Instructions Area */}
        <div style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: isDark ? 'white' : '#1e293b', margin: '0 0 16px 0' }}>
            {isMaterial ? 'Material Overview & Resources' : 'Instructions'}
          </h3>
          
          <div style={{ 
            backgroundColor: isDark ? '#262626' : '#f8fafc', 
            borderRadius: '12px', 
            padding: '24px', 
            minHeight: '180px',
            border: isDark ? '1px solid #444444' : '1px solid #e2e8f0'
          }}>
            <div 
              style={{ ...styles.instructionText, whiteSpace: 'normal', margin: 0, color: isDark ? '#d1d5db' : '#334155' }}
              dangerouslySetInnerHTML={{ __html: details }}
              onClick={handleInstructionClick}
            />
            
            {assignment?.attachments?.length > 0 && (
              <div style={styles.cardAttachments}>
                {assignment.attachments.map((att, i) => (
                  <AttachmentCard
                    key={i}
                    att={att}
                    isDark={isDark}
                    onClick={onPreviewAttachment}
                  />
                ))}
              </div>
            )}
          </div>
          
          <ActivitySubmissionSection
            isDark={isDark}
            styles={styles}
            isMaterial={isMaterial}
            isSubmitted={isSubmitted}
            assignment={assignment}
            submission={submission}
            gradeData={gradeData}
            onSubmit={onSubmit}
            onUnsubmit={onUnsubmit}
            onStartCoding={onStartCoding}
            onViewCode={onViewCode}
            onBackToClassroom={handleBackToClassroom}
          />
        </div>
      </div>
    </div>
  );
}

