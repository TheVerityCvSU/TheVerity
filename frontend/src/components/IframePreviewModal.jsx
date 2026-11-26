import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ExternalLink,
  Download,
  FileText,
  Loader2,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Image as ImageIcon
} from 'lucide-react';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { triggerDirectDownload } from '../utils/downloadFile';
import { renderAsync } from 'docx-preview';

async function fetchUploadWithProxyFallback(targetUrl) {
  try {
    const res = await fetch(targetUrl);
    if (res.ok) return res;
    throw new Error(`HTTP ${res.status}: Failed to download document`);
  } catch (err) {
    if (targetUrl.includes('/uploads/') && !targetUrl.includes('proxy=1')) {
      const sep = targetUrl.includes('?') ? '&' : '?';
      const fallbackRes = await fetch(`${targetUrl}${sep}proxy=1`);
      if (!fallbackRes.ok) {
        throw new Error(`HTTP ${fallbackRes.status}: Failed to download document`, { cause: err });
      }
      return fallbackRes;
    }
    throw err;
  }
}

export default function IframePreviewModal({ url, title, type, onClose, isDark: explicitDark }) {
  const isDark = typeof explicitDark === 'boolean'
    ? explicitDark
    : (typeof document !== 'undefined' && (document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'))) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('verity_dark_mode') === 'true');

  // Resolve media URL properly (rewrites /uploads/ from any localhost/LAN/cloud host to active server)
  const resolvedUrl = useMemo(() => {
    if (!url) return '';
    const trimmed = String(url).trim();
    const lower = trimmed.toLowerCase();
    // Reject dangerous scriptable URI schemes outright
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text/html')) {
      return '';
    }
    if (lower.startsWith('blob:') || /^data:(?:image\/(?:png|jpe?g|gif|webp|bmp|avif)|application\/pdf);base64,/i.test(trimmed)) {
      return trimmed;
    }
    if (lower.startsWith('data:')) {
      return '';
    }
    const resolved = resolveMediaUrl(trimmed);
    if (resolved && (/^https?:\/\//i.test(resolved) || resolved.startsWith('/'))) {
      return resolved;
    }
    // Domain without scheme
    if (trimmed.includes('.') && !trimmed.startsWith('/') && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return '';
  }, [url]);

  // Determine file type
  const cleanName = (title || url || '').split('?')[0].split('#')[0].toLowerCase();
  const cleanUrl = resolvedUrl.split('?')[0].split('#')[0].toLowerCase();

  const isPdf = cleanName.endsWith('.pdf') || cleanUrl.endsWith('.pdf');
  const isDocx = cleanName.endsWith('.docx') || cleanUrl.endsWith('.docx');
  const isDoc = cleanName.endsWith('.doc') || cleanUrl.endsWith('.doc');
  const isPpt = cleanName.endsWith('.ppt') || cleanName.endsWith('.pptx') || cleanUrl.endsWith('.ppt') || cleanUrl.endsWith('.pptx');
  const isExcel = cleanName.endsWith('.xls') || cleanName.endsWith('.xlsx') || cleanUrl.endsWith('.xls') || cleanUrl.endsWith('.xlsx');
  const isText = cleanName.endsWith('.txt') || cleanName.endsWith('.csv') || cleanName.endsWith('.json') || cleanName.endsWith('.md') || cleanName.endsWith('.log') || cleanUrl.endsWith('.txt') || cleanUrl.endsWith('.json') || cleanUrl.endsWith('.md');
  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(cleanName) || /\.(png|jpe?g|gif|webp|svg)$/i.test(cleanUrl) || type === 'image';
  const isOffice = isDocx || isDoc || isPpt || isExcel;

  // Type label badge
  let badgeLabel = 'Document';
  if (isPdf) badgeLabel = 'PDF Document';
  else if (isDocx) badgeLabel = 'Word Document (.docx)';
  else if (isDoc) badgeLabel = 'Word Document (.doc)';
  else if (isPpt) badgeLabel = 'PowerPoint Presentation';
  else if (isExcel) badgeLabel = 'Excel Spreadsheet';
  else if (isText) badgeLabel = 'Text File';
  else if (isImage) badgeLabel = 'Image';
  else if (type === 'link') badgeLabel = 'External Link';

  // DOCX In-Memory Rendering
  const docxRef = useRef(null);
  const [docxState, setDocxState] = useState({ url: null, loading: false, error: null });
  const docxLoading = isDocx && Boolean(resolvedUrl) && (docxState.url !== resolvedUrl ? true : docxState.loading);
  const docxError = isDocx && docxState.url === resolvedUrl ? docxState.error : null;

  useEffect(() => {
    if (!isDocx || !resolvedUrl) return;
    let isCancelled = false;

    fetchUploadWithProxyFallback(resolvedUrl)
      .then(async (res) => {
        const blob = await res.blob();
        if (isCancelled) return;
        if (docxRef.current) {
          docxRef.current.innerHTML = '';
          await renderAsync(blob, docxRef.current, null, {
            className: 'docx-preview-content',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false
          });
        }
        if (!isCancelled) {
          setDocxState({ url: resolvedUrl, loading: false, error: null });
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('[DOCX Preview] Error rendering docx:', err);
          setDocxState({ url: resolvedUrl, loading: false, error: err.message || 'Could not parse Word document' });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isDocx, resolvedUrl]);

  // Plain Text Content Loading
  const [textState, setTextState] = useState({ url: null, content: '', loading: false });
  const textContent = isText && textState.url === resolvedUrl ? textState.content : '';
  const textLoading = isText && Boolean(resolvedUrl) && (textState.url !== resolvedUrl ? true : textState.loading);

  useEffect(() => {
    if (!isText || !resolvedUrl) return;
    let isCancelled = false;

    fetchUploadWithProxyFallback(resolvedUrl)
      .then(res => res.text())
      .then(text => {
        if (!isCancelled) setTextState({ url: resolvedUrl, content: text, loading: false });
      })
      .catch(() => {
        if (!isCancelled) setTextState({ url: resolvedUrl, content: '', loading: false });
      });

    return () => { isCancelled = true; };
  }, [isText, resolvedUrl]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  const isUploadedFile = cleanUrl.includes('/uploads/');
  const isDownloadable = isPdf || isOffice || isText || isImage || isUploadedFile || type !== 'link';

  const handleDownload = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const downloadName = (title || cleanName.split('/').pop() || 'download').trim();
    triggerDirectDownload(resolvedUrl, downloadName);
  };

  const handleOpenExternal = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!resolvedUrl || !(/^(?:https?:\/\/|\/)/i.test(resolvedUrl))) return;
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
  };

  // Determine Office online viewer URL if public
  const isPublicUrl = Boolean(
    resolvedUrl.startsWith('https://') &&
    !resolvedUrl.includes('localhost') &&
    !resolvedUrl.includes('127.0.0.1') &&
    !resolvedUrl.includes('192.168.') &&
    !resolvedUrl.includes('10.')
  );
  const officeOnlineUrl = isPublicUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(resolvedUrl)}`
    : null;

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
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
        {/* Floating Top Right Header Controls */}
        <div style={{ position: 'absolute', top: '24px', right: '32px', display: 'flex', gap: '12px', zIndex: 100000 }}>
          {isDownloadable && (
            <button
              onClick={handleDownload}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.88rem',
                fontWeight: '500',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s'
              }}
              title="Download document"
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >
              <Download size={18} />
              <span>Download</span>
            </button>
          )}

          {!isDownloadable && (
            <button
              onClick={handleOpenExternal}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.88rem',
                fontWeight: '500',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s'
              }}
              title="Open in new tab"
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >
              <ExternalLink size={18} />
              <span>Open in Tab</span>
            </button>
          )}
          
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '10px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s'
            }}
            title="Close (Esc)"
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.6)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            width: '100%',
            maxWidth: '1200px',
            height: '85vh',
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div style={{
            padding: '16px 24px',
            borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              {isPdf && <FileText size={22} color="#ef4444" />}
              {isDocx && <FileText size={22} color="#2563eb" />}
              {isDoc && <FileText size={22} color="#2563eb" />}
              {isPpt && <Presentation size={22} color="#ea580c" />}
              {isExcel && <FileSpreadsheet size={22} color="#16a34a" />}
              {isText && <FileCode size={22} color="#6366f1" />}
              {isImage && <ImageIcon size={22} color="#059669" />}
              {!isOffice && !isPdf && !isText && !isImage && <ExternalLink size={22} color="#0284c7" />}

              <h3 style={{
                margin: 0,
                fontSize: '1.05rem',
                color: isDark ? '#f1f5f9' : '#1e293b',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {title || cleanName.split('/').pop() || 'Document Preview'}
              </h3>
            </div>

            <div style={{
              fontSize: '0.8rem',
              fontWeight: '600',
              color: isDark ? '#94a3b8' : '#64748b',
              padding: '4px 12px',
              backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
              borderRadius: '50px',
              whiteSpace: 'nowrap'
            }}>
              {badgeLabel}
            </div>
          </div>
          
          {/* Document Content Viewport (verity-doc-viewer keeps document pages bright & readable) */}
          <div className="verity-doc-viewer" style={{
            flex: 1,
            position: 'relative',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f1f5f9',
            colorScheme: 'light'
          }}>
            {/* 1. WORD DOCUMENT (.docx) PREVIEW */}
            {isDocx && (
              <div style={{
                flex: 1,
                width: '100%',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '24px 16px',
                backgroundColor: '#f1f5f9'
              }}>
                {docxLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px' }}>
                    <Loader2 size={36} className="animate-spin" color="#3b82f6" />
                    <span style={{ marginTop: '12px', fontSize: '0.95rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                      Rendering Word Document…
                    </span>
                  </div>
                )}

                {docxError && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 24px',
                    textAlign: 'center',
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    borderRadius: '12px',
                    maxWidth: '500px',
                    margin: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <FileText size={48} color="#2563eb" style={{ marginBottom: '16px' }} />
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                      {title || 'Word Document'}
                    </h4>
                    <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                      This document cannot be parsed in the inline viewer. You can download it to view in Microsoft Word.
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={handleDownload} style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={16} /> Download .docx
                      </button>
                    </div>
                  </div>
                )}

                <div 
                  ref={docxRef} 
                  style={{
                    width: '100%',
                    maxWidth: '900px',
                    display: docxLoading || docxError ? 'none' : 'block'
                  }} 
                  className="verity-docx-view"
                />
              </div>
            )}

            {/* 2. PDF DOCUMENT PREVIEW — #toolbar=0&navpanes=0 hides Chrome's native Save/GDrive/Print toolbar */}
            {isPdf && (() => {
              const basePdfUrl = String(resolvedUrl || '').split('#')[0];
              const pdfEmbedUrl = basePdfUrl ? `${basePdfUrl}#toolbar=0&navpanes=0` : resolvedUrl;
              return (
                <object
                  data={pdfEmbedUrl}
                  type="application/pdf"
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                >
                  <iframe
                    src={pdfEmbedUrl}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={title || "PDF Preview"}
                  >
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      padding: '40px',
                      textAlign: 'center'
                    }}>
                      <FileText size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                        PDF Preview
                      </h4>
                      <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                        Your browser could not embed this PDF directly.
                      </p>
                      <button onClick={handleDownload} style={{ padding: '10px 20px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={18} /> Download PDF
                      </button>
                    </div>
                  </iframe>
                </object>
              );
            })()}

            {/* 3. OTHER OFFICE DOCUMENTS (.doc, .ppt, .pptx, .xls, .xlsx) */}
            {isOffice && !isDocx && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 24px',
                textAlign: 'center'
              }}>
                {officeOnlineUrl ? (
                  <iframe
                    src={officeOnlineUrl}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={title || "Office Preview"}
                  />
                ) : (
                  <div style={{
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    padding: '36px 32px',
                    borderRadius: '16px',
                    maxWidth: '480px',
                    width: '100%',
                    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    {isPpt && <Presentation size={56} color="#ea580c" style={{ marginBottom: '16px' }} />}
                    {isExcel && <FileSpreadsheet size={56} color="#16a34a" style={{ marginBottom: '16px' }} />}
                    {isDoc && <FileText size={56} color="#2563eb" style={{ marginBottom: '16px' }} />}
                    
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: isDark ? '#f1f5f9' : '#1e293b', fontWeight: '600' }}>
                      {title || cleanName.split('/').pop()}
                    </h4>
                    <p style={{ margin: '0 0 24px 0', fontSize: '0.88rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                      {badgeLabel} is ready to view. Download the file to open it in your local application.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                      <button 
                        onClick={handleDownload} 
                        style={{
                          flex: 1,
                          padding: '11px 16px',
                          borderRadius: '8px',
                          background: isExcel ? '#16a34a' : isPpt ? '#ea580c' : '#2563eb',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          fontWeight: '600',
                          fontSize: '0.9rem'
                        }}
                      >
                        <Download size={18} /> Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. PLAIN TEXT / CODE FILE PREVIEW */}
            {isText && (
              <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
                {textLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Loader2 size={32} className="animate-spin" color="#6366f1" />
                  </div>
                ) : (
                  <pre style={{
                    margin: 0,
                    padding: '20px',
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#1e293b',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0'
                  }}>
                    {textContent}
                  </pre>
                )}
              </div>
            )}

            {/* 5. IMAGE PREVIEW */}
            {isImage && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                backgroundColor: isDark ? '#020617' : '#000000'
              }}>
                <img
                  src={resolvedUrl}
                  alt={title || "Image"}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              </div>
            )}

            {/* 6. EXTERNAL WEB LINK / FALLBACK IFRAME */}
            {!isPdf && !isOffice && !isText && !isImage && (
              resolvedUrl && /^(?:https?:\/\/|\/)/i.test(resolvedUrl) ? (
                <iframe
                  src={resolvedUrl}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={title || "Preview"}
                  allow="fullscreen"
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: isDark ? '#94a3b8' : '#64748b' }}>
                  Blocked unsafe or unsupported preview URL.
                </div>
              )
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
