import { ExternalLink } from 'lucide-react';

export default function AddLinkPreview({ url, title, colors }) {
  if (!url.trim()) return null;

  return (
    <div
      style={{
        backgroundColor: colors.previewBg,
        border: `1px solid ${colors.previewBorder}`,
        borderRadius: '10px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.82rem',
        color: colors.previewText
      }}
    >
      <ExternalLink size={14} style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: '600', flexShrink: 0 }}>Preview:</span>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {title.trim() || url.trim()}
      </span>
    </div>
  );
}

