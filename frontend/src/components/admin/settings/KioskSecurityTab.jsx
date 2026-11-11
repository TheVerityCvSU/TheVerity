import React from 'react';
import { motion } from 'framer-motion';
import { Monitor, Sliders, KeyRound } from 'lucide-react';
import { tabVariants } from '../../../data/adminSettings';
import { Toggle, Slider } from './SettingControls';

export default function KioskSecurityTab({ data, onChange, direction, styles, T }) {
  const update = (key, val) => onChange({ ...data, [key]: val });
  const updatePolicy = (k, v) => onChange({ ...data, passwordPolicies: { ...data.passwordPolicies, [k]: v } });

  return (
    <motion.div custom={direction} variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Kiosk Enforcement */}
      <div style={styles.card}>
        <div>
          <h3 style={styles.sectionTitle}><Monitor size={18} color={T.blue} /><span>Kiosk Enforcement Rules</span></h3>
          <p style={styles.sectionSub}>Calibrate how strict the Electron kiosk wrapper is before and during exams.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Toggle
              on={data.disableWindowsKeyAltTab}
              onToggle={() => update('disableWindowsKeyAltTab', !data.disableWindowsKeyAltTab)}
              label="Disable Windows Key & Alt-Tab"
              subtext="Locks OS-level shortcuts. Requires the native KioskLockHook to be running."
              T={T}
            />
            <Toggle
              on={data.enforceSingleMonitor}
              onToggle={() => update('enforceSingleMonitor', !data.enforceSingleMonitor)}
              label="Enforce Single Monitor Only"
              subtext="Exam will not start if the system detects a second monitor (HDMI/VGA) connected."
              T={T}
            />
            <Toggle
              on={data.blockVirtualMachine ?? true}
              onToggle={() => update('blockVirtualMachine', data.blockVirtualMachine === undefined ? false : !data.blockVirtualMachine)}
              label="Block Virtual Machine (VM) Environments"
              subtext="Exams cannot be started or executed inside VMware, VirtualBox, Hyper-V, or QEMU."
              T={T}
            />
            <Toggle
              on={data.strictClipboardBlocking}
              onToggle={() => update('strictClipboardBlocking', !data.strictClipboardBlocking)}
              label="Strict Clipboard Blocking"
              subtext="ON = Ctrl+C and Ctrl+V are fully blocked. OFF = paste is allowed but flagged in Audit Log."
              T={T}
            />
            <Toggle
              on={data.flagTabExits}
              onToggle={() => update('flagTabExits', !data.flagTabExits)}
              label="Flag Window Focus Loss / Tab Exits"
              subtext="Triggers a security flag when a student switches windows or minimizes the kiosk."
              T={T}
            />
            <Toggle
              on={data.flagMultipleLogins}
              onToggle={() => update('flagMultipleLogins', !data.flagMultipleLogins)}
              label="Flag Concurrent Multiple Login Locations"
              subtext="Detects and blocks simultaneous sessions from distinct IP addresses."
              T={T}
            />
          </div>
        </div>

        <div style={styles.divider} />

        {/* Cognitive Pause Threshold */}
        <div>
          <h3 style={styles.sectionTitle}><Sliders size={18} color={T.blue} /><span>Behavioral Detection Thresholds</span></h3>
          <p style={styles.sectionSub}>Configure inactivity and session timer triggers for automatic incident logging.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Slider
              label="Cognitive Pause Threshold"
              subtext="Seconds of typing inactivity before the system records a 'Suspicious Pause' event."
              value={data.cognitivePauseThreshold}
              onChange={v => update('cognitivePauseThreshold', v)}
              min={10} max={120} step={5} unit="s"
              T={T}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={styles.label}>Violation Threshold (Lock After X Flags)</label>
                <input
                  type="number" min="1" max="10" value={data.violationThreshold}
                  onChange={e => update('violationThreshold', parseInt(e.target.value) || 3)}
                  style={styles.input}
                />
                <span style={{ fontSize: '0.75rem', color: T.muted, marginTop: '4px', display: 'block' }}>Account locks and notifies Admin after hitting this count.</span>
              </div>
              <div>
                <label style={styles.label}>Idle Session Timeout</label>
                <select value={data.sessionTimeout} onChange={e => update('sessionTimeout', e.target.value)} style={styles.select}>
                  <option value="15m">15 Minutes</option>
                  <option value="30m">30 Minutes</option>
                  <option value="1h">1 Hour</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: T.muted, marginTop: '4px', display: 'block' }}>Force re-authentication after inactivity.</span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Password Policies */}
        <div>
          <h3 style={styles.sectionTitle}><KeyRound size={18} color={T.blue} /><span>Password & Authentication Rules</span></h3>
          <p style={styles.sectionSub}>Set minimum complexity requirements for student and instructor credentials.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              ['specialChars', 'Enforce Special Characters (!@#$%^&*)'],
              ['numbers', 'Enforce Numerical Digits (0-9)'],
              ['minLength8', 'Enforce Minimum Password Length (8 Characters)'],
            ].map(([k, lbl]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px 14px', backgroundColor: T.bg, borderRadius: '12px', border: `1px solid ${T.border}` }}>
                <input
                  type="checkbox"
                  checked={!!data.passwordPolicies?.[k]}
                  onChange={e => updatePolicy(k, e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: T.blue, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.88rem', fontWeight: '600', color: T.text }}>{lbl}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

