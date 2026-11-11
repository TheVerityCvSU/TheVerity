import React, { useState, useRef, useEffect } from 'react';
import { User, Camera, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { processAvatarImage } from '../../utils/imageResize';
import PresetAvatarTray from './PresetAvatarTray';

export default function ProfilePictureChanger({ isDark, avatar, onAvatarChange }) {
  const { currentUser } = useCurrentUser();
  const fileInputRef = useRef(null);
  const [feedback, setFeedback] = useState(null);
  const [imgError, setImgError] = useState(false);

  const currentAvatar = avatar !== undefined ? avatar : (currentUser?.avatar || currentUser?.profilePicture);
  const name = currentUser?.name || 'User';

  useEffect(() => {
    setImgError(false);
  }, [currentAvatar]);

  const getInitials = (str) => {
    if (!str || str === 'User') return 'V';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const showFeedback = (msg, isError = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await processAvatarImage(file);
      onAvatarChange(dataUrl);
      showFeedback('Profile picture ready to save!');
    } catch (err) {
      showFeedback(err?.message || 'Failed to read image file.', true);
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectPreset = (preset) => {
    onAvatarChange(preset.svg);
    showFeedback(`Avatar selected: "${preset.name}". Remember to Save Changes.`);
  };

  const handleRemovePhoto = () => {
    onAvatarChange(null);
    showFeedback('Photo removed. Restored to default initial badge.');
  };

  const initials = getInitials(name);

  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      borderRadius: '16px',
      backgroundColor: isDark ? '#3A3A3A' : '#f9fafb',
      border: isDark ? '1px solid #4D4D4D' : '1px solid #e2e8f0',
      transition: 'background-color 0.25s ease, border-color 0.25s ease'
    }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/gif"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
        {/* Avatar Interactive Circle */}
        <div
          onClick={() => fileInputRef.current?.click()}
          title="Click to change profile picture"
          style={{
            position: 'relative',
            width: '92px',
            height: '92px',
            borderRadius: '50%',
            cursor: 'pointer',
            flexShrink: 0,
            border: '2.5px solid #10b981',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.22)',
            backgroundColor: currentAvatar && !imgError ? 'transparent' : (isDark ? '#3C3C3C' : '#e2e8f0'),
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease'
          }}
          className="btn-anim"
        >
          {currentAvatar && !imgError ? (
            <img
              src={currentAvatar}
              alt={name}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
                display: 'block'
              }}
            />
          ) : initials ? (
            <span style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: isDark ? '#E8EAED' : '#1e293b',
              letterSpacing: '0.02em',
              userSelect: 'none'
            }}>
              {initials}
            </span>
          ) : (
            <User size={42} color={isDark ? '#9AA0A6' : '#64748b'} />
          )}

          {/* Camera hover badge indicator */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '28px',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Camera size={14} />
          </div>
        </div>

        {/* Text Details & Primary Actions */}
        <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{
              fontSize: '1rem',
              fontWeight: '700',
              color: isDark ? '#E8EAED' : '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              Profile Picture
              {currentAvatar && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: '#10b981',
                  backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  Active
                </span>
              )}
            </div>
            <div style={{
              fontSize: '0.82rem',
              color: isDark ? '#9AA0A6' : '#64748b',
              marginTop: '2px',
              lineHeight: 1.4
            }}>
              Upload a personalized photo (JPG, PNG, WebP) or select an avatar badge below.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 18px',
                borderRadius: '50px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                transition: 'opacity 0.15s ease'
              }}
              title="Upload photo from computer"
            >
              <Upload size={14} /> Upload Photo
            </button>

            {currentAvatar && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '50px',
                  backgroundColor: isDark ? '#464646' : '#e5e7eb',
                  color: isDark ? '#E8EAED' : '#475569',
                  border: isDark ? '1px solid #5A5A5A' : 'none',
                  fontWeight: '600',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                title="Remove current avatar and reset to initials"
              >
                <Trash2 size={14} color="#ef4444" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preset Avatar Badges Tray */}
      <PresetAvatarTray
        isDark={isDark}
        currentAvatar={currentAvatar}
        onSelectPreset={handleSelectPreset}
      />

      {/* Notification Banner */}
      {feedback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          borderRadius: '10px',
          fontSize: '0.85rem',
          fontWeight: '600',
          backgroundColor: feedback.isError ? (isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2') : (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5'),
          color: feedback.isError ? '#ef4444' : '#10b981',
          border: feedback.isError ? '1px solid #f87171' : '1px solid #34d399'
        }}>
          {!feedback.isError && <CheckCircle2 size={16} />}
          <span>{feedback.msg}</span>
        </div>
      )}
    </div>
  );
}
