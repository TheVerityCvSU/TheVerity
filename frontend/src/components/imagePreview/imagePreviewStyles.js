export const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 12, 16, 0.88)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 999999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    overflow: 'hidden'
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
    zIndex: 10
  },
  headerTitle: {
    color: '#F3F4F6',
    fontSize: '0.95rem',
    fontWeight: '500',
    maxWidth: '60vw',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textShadow: '0 1px 3px rgba(0,0,0,0.5)'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  iconBtn: {
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '8px',
    color: '#FFFFFF',
    padding: '7px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  closeBtn: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '8px',
    color: '#FF6B6B',
    padding: '7px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  imageViewport: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative'
  },
  image: {
    maxWidth: '85vw',
    maxHeight: '80vh',
    objectFit: 'contain',
    borderRadius: '6px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'auto',
    userSelect: 'none'
  },
  floatingToolbar: {
    position: 'absolute',
    bottom: '48px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(24, 26, 32, 0.88)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '30px',
    padding: '6px 14px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    zIndex: 10
  },
  toolBtn: {
    background: 'transparent',
    border: 'none',
    color: '#E5E7EB',
    padding: '6px 8px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  zoomLabelBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '14px',
    color: '#F9FAFB',
    fontSize: '0.82rem',
    fontWeight: '600',
    padding: '4px 10px',
    minWidth: '55px',
    textAlign: 'center',
    cursor: 'pointer'
  },
  divider: {
    width: '1px',
    height: '18px',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    margin: '0 4px'
  },
  hintPill: {
    position: 'absolute',
    bottom: '16px',
    fontSize: '0.72rem',
    color: 'rgba(255, 255, 255, 0.5)',
    pointerEvents: 'none',
    letterSpacing: '0.02em',
    zIndex: 10
  }
};

