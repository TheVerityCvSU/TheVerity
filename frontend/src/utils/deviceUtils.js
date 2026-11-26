/**
 * deviceUtils.js
 * 
 * Device and environment detection utility for The Verity.
 * 
 * Enforces laboratory policy:
 * - Desktop & Laptop computers in ComLab must use the official standalone application (.exe / Electron)
 *   so that kiosk lockdown, single monitor enforcement, and VM detection are active.
 * - Standard web browser access on desktop/laptop is blocked for students.
 * - Web browser access is strictly reserved for genuine mobile phones / tablets for online students
 *   who do not have access to a desktop or laptop computer.
 * - Browser Developer Tools (F12), Device Mode emulation (Toggle device toolbar), and User-Agent
 *   spoofing are detected and strictly blocked.
 */

/**
 * Checks if running inside the official Electron desktop application (.exe)
 * @returns {boolean}
 */
export const isElectronApp = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.electronAPI);
};

/**
 * Detects if Chrome/Edge/Firefox Developer Tools (F12) are open
 * or if the user is using Device Emulation / Responsive mode on a desktop PC.
 * @returns {boolean}
 */
export const isDevToolsOrEmulation = () => {
  if (typeof window === 'undefined') return false;
  // Official Electron client is not a web browser
  if (isElectronApp()) return false;

  // 1. Docked DevTools gap detection (Sindre Sorhus heuristic)
  // When DevTools is docked vertically or horizontally, outer vs inner dimensions differ significantly
  const threshold = 160;
  const widthGap = (window.outerWidth - window.innerWidth) > threshold;
  const heightGap = (window.outerHeight - window.innerHeight) > threshold;
  if (widthGap || heightGap) {
    return true;
  }

  // 2. Platform mismatch detection (Spoofing mobile on a desktop OS)
  const platform = (navigator.platform || '').toLowerCase();
  const ua = (navigator.userAgent || '').toLowerCase();
  const uaDataPlatform = (navigator.userAgentData?.platform || '').toLowerCase();

  const isWindowsPlatform = platform.includes('win') || uaDataPlatform.includes('win');
  const isMacDesktopPlatform = (platform.includes('mac') && !platform.includes('iphone') && !platform.includes('ipad') && navigator.maxTouchPoints <= 1) || uaDataPlatform.includes('mac');
  const isLinuxDesktopPlatform = (platform.includes('linux x86') || platform.includes('x11')) || uaDataPlatform.includes('linux');

  const claimsMobile = /android|iphone|ipod|ipad|mobile|crios|fennec|blackberry|iemobile/i.test(ua);

  // If running on a desktop operating system (Windows, Mac, Linux x86) while claiming to be mobile -> DevTools Device Emulation!
  if ((isWindowsPlatform || isMacDesktopPlatform || isLinuxDesktopPlatform) && claimsMobile) {
    return true;
  }

  // 3. Pointer & Hover hardware mismatch
  // Real mobile phones NEVER have a fine mouse pointer or hover capabilities.
  // When Chrome DevTools emulates a phone, it still reports the physical mouse connected to the PC!
  const hasFinePointer = window.matchMedia && window.matchMedia('(any-pointer: fine)').matches;
  const hasHover = window.matchMedia && window.matchMedia('(any-hover: hover)').matches;

  if (claimsMobile && (hasFinePointer || hasHover)) {
    return true;
  }

  // 4. Physical Monitor Screen Resolution
  // Physical smartphone screens in CSS pixels are <= 820px. Desktop monitors are >= 1024px.
  // In Chrome DevTools, window.screen.width typically retains the PC monitor's resolution (e.g. 1920x1080).
  if (claimsMobile && window.screen && (window.screen.width >= 1024 || window.screen.availWidth >= 1024)) {
    return true;
  }

  return false;
};

/**
 * Checks if the current client is a GENUINE mobile phone or handheld touch device
 * (allowed ONLY for real mobile devices without desktop hardware indicators or DevTools).
 * @returns {boolean}
 */
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  if (isElectronApp()) return false;

  // If DevTools or device emulation is detected, it is NOT a genuine mobile device!
  if (isDevToolsOrEmulation()) {
    return false;
  }

  const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  const uaDataPlatform = (navigator.userAgentData?.platform || '').toLowerCase();

  // If underlying platform is Windows, Mac (without touch), or Linux x86, it is a desktop!
  if (platform.includes('win') || uaDataPlatform.includes('win')) return false;
  if (platform.includes('linux x86') || uaDataPlatform.includes('linux')) return false;
  if (platform.includes('mac') && !platform.includes('iphone') && !platform.includes('ipad') && navigator.maxTouchPoints <= 1) return false;

  // A genuine phone does not have fine mouse pointer or hover capability
  if (window.matchMedia && window.matchMedia('(any-pointer: fine)').matches) return false;
  if (window.matchMedia && window.matchMedia('(any-hover: hover)').matches) return false;

  // Standard phone user-agents
  const mobileRegex = /android|iphone|ipod|ipad|blackberry|iemobile|opera mini|mobile|crios|fennec|windows phone/i;
  if (mobileRegex.test(ua)) return true;

  // Real iPadOS (Safari reports MacIntel but maxTouchPoints > 1 and screen <= 1024)
  const isIPadOS = (platform === 'macintel' || ua.includes('macintosh')) &&
    navigator.maxTouchPoints > 1 &&
    window.screen.width <= 1024;
  if (isIPadOS) return true;

  return false;
};

/**
 * Global toggle to disable the desktop web browser blocker for local testing/inspection.
 * Keep false in production so ComLab & PC web browser access is strictly blocked for students
 * while genuine mobile phones/tablets and the official The Verity (.exe) app remain allowed.
 */
export const DISABLE_DESKTOP_WEB_BLOCKER = Boolean(import.meta.env?.DEV);

/**
 * Checks if the user is running in a desktop or laptop web browser
 * (e.g., Chrome, Edge, Firefox, Brave on Windows/Mac/Linux outside of Electron),
 * OR attempting to use F12 Developer Tools / Device Mode emulation on desktop.
 * In ComLab, students must NOT use desktop web browsers; they must run The Verity.exe.
 * @returns {boolean}
 */
export const isDesktopWebBrowser = () => {
  // If running inside the official .exe (Electron), it is NOT a web browser
  if (isElectronApp()) return false;

  // If disabled for browser testing, bypass the blocker
  if (DISABLE_DESKTOP_WEB_BLOCKER) {
    return false;
  }

  // If DevTools or device emulation is detected, block it immediately
  if (isDevToolsOrEmulation()) return true;

  // If on a genuine permitted mobile device, allow mobile web
  if (isMobileDevice()) return false;

  // Otherwise, it is a desktop/laptop web browser
  return true;
};
