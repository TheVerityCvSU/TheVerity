import { motion } from 'framer-motion';

export default function DotnetDownloadingStage({ isDarkTheme, status }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.88rem', fontWeight: '600', color: isDarkTheme ? '#f1f5f9' : '#0f172a' }}>
          Downloading .NET SDK...
        </span>
        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: isDarkTheme ? '#818cf8' : '#4f46e5' }}>
          {status.percent}%
        </span>
      </div>

      {/* Progress Track */}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        borderRadius: '9999px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <motion.div
          style={{
            height: '100%',
            borderRadius: '9999px',
            background: 'linear-gradient(90deg, #4f46e5, #06b6d4)'
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(3, status.percent)}%` }}
          transition={{ ease: 'easeOut', duration: 0.2 }}
        />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: isDarkTheme ? '#94a3b8' : '#64748b'
      }}>
        <span>{status.downloadedMB} MB / {status.totalMB} MB</span>
        <span>{status.speed}</span>
      </div>

      <p style={{
        margin: '18px 0 0',
        fontSize: '0.8rem',
        color: isDarkTheme ? '#64748b' : '#94a3b8',
        lineHeight: '1.4'
      }}>
        Verity is retrieving the verified Microsoft .NET binary directly from official Microsoft servers.
      </p>
    </div>
  );
}

