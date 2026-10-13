import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';

export default function IframePreviewModal({ url, title, type, onClose }) {
  // Fix URL scheme if missing
  const targetUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `https://${url}`;

  // For docs like DOCX/PDF, we might want to use Google Docs Viewer if it's a direct file link
  // However, modern browsers can natively view PDFs. 
  // We'll just render it directly. For external web links, iframes might be blocked by X-Frame-Options,
  // but it's the standard way to do an in-app popup.
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
        onClick={onClose}
      >
        <div style={{ position: 'absolute', top: '24px', right: '32px', display: 'flex', gap: '16px' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              transition: 'background 0.2s'
            }}
            title="Open in new tab"
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <ExternalLink size={24} />
          </button>
          
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              transition: 'background 0.2s'
            }}
            title="Close"
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X size={24} />
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            width: '100%',
            maxWidth: '1200px',
            height: '85vh',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: '600' }}>
              {title || (type === 'document' ? 'Document Preview' : 'Link Preview')}
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '4px 12px', backgroundColor: '#e2e8f0', borderRadius: '50px' }}>
              {type === 'document' ? 'Document' : 'External Link'}
            </div>
          </div>
          
          <iframe 
            src={targetUrl}
            style={{ width: '100%', flex: 1, border: 'none' }}
            title={title || "Preview"}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
