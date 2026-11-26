const { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell, session, protocol, net, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { fork, spawn } = require('child_process');
const { initLocalDb, localDbAPI } = require('./local-db.cjs');
const { initStartupVmDetection, getVmStatus, getCachedVmStatusSync } = require('./vm-detect.cjs');
const { initLanClient, getDiscoveredServer, setDiscoveredServer, verifyHttpServer, resolveLanHostUrl, runDiscoveryScan, stopLanClient } = require('./lan-client.cjs');
const { isAllowedExternalUrl, isAllowedGoogleAuthUrl, isAuthorizedIpcSender, registerAuthorizedIpcHandlers, resolveSafeDistFile } = require('./security-utils.cjs');

// Persistent diagnostic and startup logging
const logFile = path.join(os.tmpdir(), 'the-verity-startup.log');
function logStartup(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (_) { }
  console.log(msg);
}

logStartup('========================================================');
logStartup(`[main] The Verity Process Starting: PID ${process.pid}`);
logStartup(`[main] Executable: ${process.execPath}`);
logStartup(`[main] isPackaged: ${app.isPackaged}, Platform: ${process.platform}, Arch: ${process.arch}`);
logStartup(`[main] Argv: ${JSON.stringify(process.argv)}`);
logStartup('========================================================');

// Startup Virtual Machine (VM) detection check
initStartupVmDetection(logStartup);

// Immediate process-level crash guards
process.on('uncaughtException', (err) => {
  logStartup(`[main] FATAL uncaughtException: ${err?.stack || err?.message || err}`);
  try {
    dialog.showErrorBox(
      'The Verity - Startup Error',
      `A fatal error occurred:\n\n${err?.message || err}\n\nDiagnostic log written to:\n${logFile}`
    );
  } catch (_) { }
});

process.on('unhandledRejection', (reason) => {
  logStartup(`[main] Unhandled Promise Rejection: ${reason?.stack || reason?.message || reason}`);
});

// Single Instance Lock: prevent silent background exits if an instance is already running
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logStartup('[main] Single instance lock failed. Another instance of The Verity is already running.');
  try {
    dialog.showErrorBox(
      'The Verity is Already Running',
      'Another instance of The Verity is already running on this computer.\n\n' +
      'Please open Windows Task Manager (Ctrl + Shift + Esc), close any existing "The Verity" processes, and try launching again.'
    );
  } catch (_) { }
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  logStartup('[main] Second instance launched; focusing active window');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else if (splashWindow) {
    if (splashWindow.isMinimized()) splashWindow.restore();
    splashWindow.show();
    splashWindow.focus();
  }
});

// Hardware acceleration and GPU compatibility switches for Windows 11 and diverse laptop GPUs
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
app.name = 'The Verity';
if (process.platform === 'win32') {
  app.setAppUserModelId('com.verity.app');
}
app.userAgentFallback = CHROME_USER_AGENT;

let mainWindow;
let splashWindow = null;
let googleAuthWindow = null;
let serverProcess = null;
let hudProcess = null; // native keyboard-hook helper (engaged only during exam lockdown)
let lockdownActive = false;
let lockFilePath = null;

function startKeyboardHook() {
  if (!app.isPackaged || process.platform !== 'win32') return; // dev mode or non-Windows
  if (hudProcess) return; // already started
  try {
    const exePath = path.join(process.resourcesPath, 'native', 'KioskLockHook.exe');
    lockFilePath = path.join(app.getPath('userData'), '.verity-lock');
    if (!fs.existsSync(exePath)) {
      logStartup(`[main] KioskLockHook.exe not found at ${exePath}`);
      return;
    }
    setLockedFile(false);
    hudProcess = spawn(exePath, [lockFilePath, String(process.pid)], { windowsHide: true, stdio: 'ignore' });
    hudProcess.on('error', (err) => {
      hudProcess = null;
      logStartup(`[main] hook error (non-fatal): ${err.message}`);
    });
    hudProcess.on('exit', () => {
      hudProcess = null;
    });
    hudProcess.on('close', () => {
      hudProcess = null;
    });
    logStartup('[main] Keyboard hook started for exam lockdown');
  } catch (err) {
    hudProcess = null;
    logStartup(`[main] Could not start keyboard hook (non-fatal): ${err.message}`);
  }
}

function setLockedFile(locked) {
  if (!lockFilePath) return;
  try {
    if (locked) {
      fs.writeFileSync(lockFilePath, String(Date.now()));
      logStartup(`[main] Lock file CREATED: ${lockFilePath}`);
    } else if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
      logStartup(`[main] Lock file DELETED: ${lockFilePath}`);
    }
  } catch (err) {
    logStartup(`[main] Could not toggle lock file: ${err.message}`);
  }
}

function killKeyboardHook() {
  if (hudProcess && hudProcess.exitCode === null) {
    try { hudProcess.kill(); } catch (_) { }
    hudProcess = null;
  }
  setLockedFile(false);
}

function seedDatabase(dataDir) {
  const dbPath = path.join(dataDir, 'database.json');
  const seedPath = app.isPackaged
    ? path.join(process.resourcesPath, 'database.json')
    : path.join(__dirname, '..', 'server', 'database.json');

  let current = { users: [], classwork: {}, classrooms: [], securityFlags: {} };
  if (fs.existsSync(dbPath)) {
    try { current = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch { /* corrupt */ }
  }
  let seedData = { users: [] };
  try { seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8')); } catch { }

  const existingEmails = new Set((current.users || []).map((u) => u.email));
  let added = 0;
  for (const u of (seedData.users || [])) {
    if (!existingEmails.has(u.email)) {
      current.users.push(u);
      added++;
    }
  }

  if (added > 0) {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
      logStartup(`[main] Seeded ${added} accounts into: ${dbPath}`);
    } catch (err) {
      logStartup(`[main] Could not seed database: ${err.message}`);
    }
  }
}

function startServer() {
  try {
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath, 'dist-server', 'server-bundle.cjs')
      : path.join(__dirname, '..', 'dist-server', 'server-bundle.cjs');
    const dataDir = app.isPackaged
      ? app.getPath('userData')
      : path.join(__dirname, '..', 'server');

    if (!fs.existsSync(serverPath)) {
      logStartup(`[main] server-bundle.cjs not found at ${serverPath}`);
      return;
    }

    if (app.isPackaged) {
      try {
        seedDatabase(dataDir);
      } catch (seedErr) {
        logStartup(`[main] seedDatabase notice: ${seedErr.message}`);
      }
    }

    const envFile = app.isPackaged
      ? path.join(process.resourcesPath, '.env')
      : path.join(__dirname, '..', 'server', '.env');

    const parsedEnv = {};
    if (fs.existsSync(envFile)) {
      try {
        const raw = fs.readFileSync(envFile, 'utf8');
        for (const line of raw.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (key) parsedEnv[key] = val;
          }
        }
      } catch (_) { }
    }

    const isHostMode = process.argv.includes('--host') || process.env.IS_LAN_HOST === 'true';
    logStartup(`[main] Forking server process: ${serverPath} (isHostMode: ${isHostMode})`);
    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        ...parsedEnv,
        DATA_DIR: dataDir,
        NODE_ENV: 'production',
        APP_VERSION: app.getVersion(),
        IS_LAN_HOST: isHostMode ? 'true' : 'false'
      },
      silent: true,
    });
    serverProcess.stdout.on('data', (d) => {
      const s = d.toString().trim();
      if (s) logStartup(`[server] ${s}`);
    });
    serverProcess.stderr.on('data', (d) => {
      const s = d.toString().trim();
      if (s) logStartup(`[server-err] ${s}`);
    });
    serverProcess.on('exit', (code, signal) => {
      logStartup(`[server] exited with code ${code}, signal ${signal}`);
      serverProcess = null;
    });
  } catch (err) {
    logStartup(`[main] startServer error (non-fatal): ${err.message}`);
  }
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// Shortcuts we swallow while a student is locked in.
// (Bare Super, Super+L, and Ctrl+Alt+Del are handled at the low-level WH_KEYBOARD_LL hook by KioskLockHook.exe to avoid Windows hotkey registration beeps)
const LOCKED_SHORTCUTS = [
  'Alt+Tab',
  'Alt+F4',
  'Alt+Escape',
  'Alt+Space',
  'Super+Tab',        // Task View
  'Meta+Tab',         // Task View (alternate key name)
  'Super+D',          // Show Desktop
  'Super+M',          // Minimize all
  'Super+E',          // File Explorer
  'Super+R',          // Run dialog
  'Super+S',          // Search
  'Super+A',          // Action center
  'Super+I',          // Settings
  'Super+X',          // Quick link menu
  'Super+V',          // Windows Clipboard History
  'Meta+V',           // Windows Clipboard History alternate
  'Super+Alt+V',
  'CommandOrControl+Super+V',
  'CommandOrControl+W',
  'CommandOrControl+Shift+W',
  'CommandOrControl+Tab',
  'F11',
  'F12',
  'CommandOrControl+Shift+I',
  'CommandOrControl+Shift+J',
  'CommandOrControl+Shift+C',
  'CommandOrControl+U',
  'CommandOrControl+R',
  'CommandOrControl+Shift+R',
  'F5',
];

function createSplashWindow() {
  logStartup('[main] Creating splash window...');
  splashWindow = new BrowserWindow({
    width: 480,
    height: 240,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    show: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html')).catch((err) => {
    logStartup(`[main] splashWindow.loadFile error: ${err.message}`);
  });
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow() {
  logStartup('[main] Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Initially hidden while splash screen is active
    icon: path.join(__dirname, 'assets', 'icon.png'),
    kiosk: false, // start unlocked — only students get locked down (after login)
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
      // Keep sockets, presence heartbeats and live monitoring streaming at full speed
      // even when the kiosk window is momentarily blurred/occluded.
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on('devtools-opened', () => {
    if (app.isPackaged || lockdownActive) {
      mainWindow.webContents.closeDevTools();
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isDevToolsShortcut =
      input.key === 'F12' ||
      ((input.control || input.meta) && input.shift && ['I', 'i', 'J', 'j', 'C', 'c'].includes(input.key)) ||
      ((input.control || input.meta) && ['u', 'U'].includes(input.key));

    if (isDevToolsShortcut && (app.isPackaged || lockdownActive)) {
      event.preventDefault();
      return;
    }

    if (lockdownActive) {
      const isReloadShortcut =
        input.key === 'F5' ||
        ((input.control || input.meta) && ['r', 'R'].includes(input.key));
      if (isReloadShortcut) {
        event.preventDefault();
        return;
      }

      const isClipboardHistory =
        (input.meta || input.super) && ['v', 'V'].includes(input.key);
      if (isClipboardHistory) {
        event.preventDefault();
        return;
      }

      // Window-close / escape shortcuts (defense in depth alongside globalShortcut + native hook)
      const isCloseShortcut =
        (input.alt && input.key === 'F4') ||
        ((input.control || input.meta) && ['w', 'W', 'q', 'Q'].includes(input.key)) ||
        input.key === 'F11';
      if (isCloseShortcut) {
        event.preventDefault();
        return;
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (lockdownActive) {
      return { action: 'deny' };
    }
    if (isAllowedGoogleAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 650,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            userAgent: CHROME_USER_AGENT,
          }
        }
      };
    }

    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (childWindow) => {
    logStartup('[main] Child window created from mainWindow webContents');
    childWindow.on('closed', () => {
      logStartup('[main] Child window closed, notifying google-auth-closed');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('google-auth-closed');
      }
    });
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        // Packaged Electron serves dist/ on http://localhost:5173 via protocol.handle('http', ...),
        // so in-app navigation/reloads on localhost:5173 must stay inside Electron rather than opening a browser.
        if (parsedUrl.host === 'localhost:5173') {
          return;
        }
        event.preventDefault();
        if (!lockdownActive && isAllowedExternalUrl(navigationUrl)) {
          shell.openExternal(navigationUrl);
        }
      } else {
        event.preventDefault();
      }
    } catch (_) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logStartup(`[main] mainWindow did-fail-load: code ${errorCode}, ${errorDescription}, url: ${validatedURL}`);
    if (validatedURL && validatedURL.includes('localhost:5173') && app.isPackaged) {
      const fallbackFile = path.join(__dirname, '../dist/index.html');
      logStartup(`[main] Falling back to direct loadFile: ${fallbackFile}`);
      mainWindow.loadFile(fallbackFile).catch(() => { });
    }
    launchMainWindow();
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logStartup(`[main] mainWindow render-process-gone: ${JSON.stringify(details)}`);
  });

  const launchMainWindow = () => {
    if (!mainWindow) return;
    logStartup('[main] Revealing mainWindow and closing splashWindow');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  };

  const targetUrl = 'http://localhost:5173';
  logStartup(`[main] mainWindow loading ${targetUrl}...`);
  mainWindow.loadURL(targetUrl).catch((err) => {
    logStartup(`[main] mainWindow.loadURL failed: ${err.message}. Trying direct loadFile...`);
    if (app.isPackaged) {
      const fallbackFile = path.join(__dirname, '../dist/index.html');
      mainWindow.loadFile(fallbackFile).catch((fErr) => {
        logStartup(`[main] fallback loadFile failed: ${fErr.message}`);
      });
    }
    launchMainWindow();
  });

  const splashStartTime = Date.now();
  mainWindow.once('ready-to-show', () => {
    logStartup('[main] mainWindow ready-to-show event fired');
    const elapsed = Date.now() - splashStartTime;
    const remainingDelay = Math.max(0, 1800 - elapsed);
    setTimeout(launchMainWindow, remainingDelay);
  });

  // Safety fallback in case ready-to-show takes too long
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      logStartup('[main] Splash fallback timeout (3500ms) triggered - forcing mainWindow reveal');
      launchMainWindow();
    }
  }, 3500);

  function enforceKioskTopmost() {
    if (!mainWindow || mainWindow.isDestroyed() || !lockdownActive) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  }

  mainWindow.on('focus', () => {
    if (lockdownActive) {
      mainWindow.setKiosk(true);
      enforceKioskTopmost();
    }
  });

  mainWindow.on('enter-full-screen', () => {
    if (lockdownActive) {
      enforceKioskTopmost();
      setTimeout(enforceKioskTopmost, 100);
    }
  });

  mainWindow.on('blur', () => {
    if (!lockdownActive) return;
    setTimeout(() => {
      if (!lockdownActive) return;
      if (BrowserWindow.getFocusedWindow()) return;
      enforceKioskTopmost();
    }, 120);
  });

  mainWindow.on('minimize', (e) => {
    if (lockdownActive) {
      e.preventDefault();
      enforceKioskTopmost();
    }
  });

  mainWindow.on('close', (e) => {
    if (lockdownActive) e.preventDefault();
  });

  mainWindow.on('closed', () => {
    if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
      googleAuthWindow.close();
      googleAuthWindow = null;
    }
    mainWindow = null;
  });
}

function enableLockdown(options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const alreadyLocked = lockdownActive && mainWindow.isKiosk();
  lockdownActive = true;
  logStartup(`[lockdown] enableLockdown engaged (alreadyLocked: ${alreadyLocked})`);

  try {
    if (mainWindow.webContents && mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    }
  } catch (_) { }

  if (!alreadyLocked) {
    mainWindow.setFullScreen(true);
    mainWindow.setKiosk(true);
    mainWindow.setVisibleOnAllWorkspaces(true);
  }
  try { mainWindow.setMinimizable(false); } catch (_) { }
  try { mainWindow.setClosable(false); } catch (_) { }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();

  setTimeout(() => {
    if (lockdownActive && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.moveTop();
      mainWindow.focus();
    }
  }, 50);

  setTimeout(() => {
    if (lockdownActive && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.moveTop();
      mainWindow.focus();
    }
  }, 150);

  setTimeout(() => {
    if (lockdownActive && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.moveTop();
      mainWindow.focus();
    }
  }, 300);

  setTimeout(() => {
    if (lockdownActive && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.moveTop();
      mainWindow.focus();
    }
  }, 600);

  if (options.disableWindowsKeyAltTab !== false) {
    if (!hudProcess) {
      startKeyboardHook();
    }
    setLockedFile(true);
    for (const accel of LOCKED_SHORTCUTS) {
      try {
        if (!globalShortcut.isRegistered(accel)) {
          globalShortcut.register(accel, () => { });
        }
      } catch (_) { }
    }
  } else {
    setLockedFile(false);
    globalShortcut.unregisterAll();
  }
}

function disableLockdown() {
  logStartup('[lockdown] disableLockdown engaged');
  lockdownActive = false;
  globalShortcut.unregisterAll();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
    try { mainWindow.setMinimizable(true); } catch (_) { }
    try { mainWindow.setClosable(true); } catch (_) { }
  }
  setLockedFile(false);
  killKeyboardHook();
}

// App lifecycle
app.whenReady().then(() => {
  logStartup('[main] app.whenReady fired');

  Menu.setApplicationMenu(null);

  // Intercept Google OAuth and Google API requests to prevent disallowed_useragent blocks
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://accounts.google.com/*', 'https://*.google.com/*', 'https://oauth2.googleapis.com/*'] },
    (details, callback) => {
      const { requestHeaders } = details;
      requestHeaders['User-Agent'] = CHROME_USER_AGENT;
      if (!requestHeaders['Origin'] || requestHeaders['Origin'] === 'file://' || requestHeaders['Origin'] === 'null') {
        requestHeaders['Origin'] = 'http://localhost:5173';
        requestHeaders['Referer'] = 'http://localhost:5173/';
      }
      callback({ requestHeaders });
    }
  );

  if (app.isPackaged) {
    protocol.handle('http', (request) => {
      try {
        const url = new URL(request.url);
        if (url.hostname === 'localhost' && url.port === '5173') {
          const distDir = path.join(__dirname, '../dist');
          let { safe, filePath } = resolveSafeDistFile(distDir, url.pathname === '/' ? '/index.html' : url.pathname);
          if (!safe || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            filePath = path.join(distDir, 'index.html');
          }
          return net.fetch(pathToFileURL(filePath).href);
        }
      } catch (e) {
        logStartup(`[protocol] handle error: ${e.message}`);
      }
      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }

  // Clean any leftover lockfile from a prior unclean exit before launching UI
  try {
    const staleLock = path.join(app.getPath('userData'), '.verity-lock');
    if (fs.existsSync(staleLock)) fs.unlinkSync(staleLock);
  } catch (_) { }

  createSplashWindow();

  try {
    initLocalDb(app.getPath('userData'));
    logStartup('[main] Local SQLite database initialized successfully');
  } catch (e) {
    logStartup(`[main] initLocalDb error: ${e.message}`);
  }

  // Automatic LAN Discovery for ComLab environment
  try {
    initLanClient(() => mainWindow, localDbAPI);
    logStartup('[main] LAN Auto-Discovery client initialized');
  } catch (lanErr) {
    logStartup(`[main] initLanClient error: ${lanErr.message}`);
  }

  if (app.isPackaged) {
    logStartup('[main] Production mode: launching embedded server process');
    startServer();
    createWindow();
  } else {
    logStartup('[main] Dev mode: creating window directly');
    createWindow();
  }
});

// --- IPC from renderer (React) ---
ipcMain.on('enable-lockdown', (event, options) => {
  if (!isAuthorizedIpcSender(event)) return;
  logStartup(`[main] enable-lockdown received: ${JSON.stringify(options || {})}`);
  enableLockdown(options);
});

ipcMain.on('disable-lockdown', (event) => {
  if (!isAuthorizedIpcSender(event)) return;
  logStartup('[main] disable-lockdown received');
  disableLockdown();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

const { registerUpdateIpc } = require('./updater.cjs');
registerUpdateIpc(() => mainWindow, disableLockdown);

ipcMain.handle('get-display-count', (event) => {
  if (!isAuthorizedIpcSender(event)) return 1;
  const { screen } = require('electron');
  return screen.getAllDisplays().length;
});

ipcMain.handle('check-vm-status', async (event) => {
  if (!isAuthorizedIpcSender(event)) return { isVm: false, reasons: [] };
  return await getVmStatus();
});

ipcMain.handle('get-cached-vm-status', (event) => {
  if (!isAuthorizedIpcSender(event)) return { isVm: false, reasons: [] };
  return getCachedVmStatusSync();
});

ipcMain.handle('clear-clipboard', (event) => {
  if (!isAuthorizedIpcSender(event)) return false;
  try {
    clipboard.clear();
    return true;
  } catch (_) {
    return false;
  }
});

ipcMain.on('close-app', (event) => {
  if (!isAuthorizedIpcSender(event)) return;
  disableLockdown();
  app.quit();
});

ipcMain.on('open-external', (event, url) => {
  if (!isAuthorizedIpcSender(event)) return;
  if (lockdownActive) return;
  if (isAllowedExternalUrl(url)) {
    shell.openExternal(url);
  }
});

ipcMain.on('open-google-auth', (event, url) => {
  if (!isAuthorizedIpcSender(event)) return;
  if (lockdownActive) return;
  if (!isAllowedGoogleAuthUrl(url)) {
    logStartup(`[main] Blocked disallowed open-google-auth URL: ${url}`);
    return;
  }
  logStartup(`[main] open-google-auth requested: ${url}`);
  if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
    googleAuthWindow.focus();
    return;
  }

  googleAuthWindow = new BrowserWindow({
    width: 520,
    height: 650,
    title: 'Sign in with Google - The Verity',
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false,
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      userAgent: CHROME_USER_AGENT,
    }
  });

  googleAuthWindow.webContents.setWindowOpenHandler(({ url: childUrl }) => {
    if (!lockdownActive && isAllowedExternalUrl(childUrl)) {
      shell.openExternal(childUrl);
    }
    return { action: 'deny' };
  });

  googleAuthWindow.webContents.on('will-navigate', (navEvent, navUrl) => {
    if (!isAllowedGoogleAuthUrl(navUrl)) {
      navEvent.preventDefault();
    }
  });

  googleAuthWindow.loadURL(url).catch((err) => {
    logStartup(`[main] googleAuthWindow loadURL error: ${err.message}`);
  });

  googleAuthWindow.on('closed', () => {
    logStartup('[main] googleAuthWindow closed by user');
    googleAuthWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('google-auth-closed');
    }
  });
});

ipcMain.on('close-google-auth', (event) => {
  if (!isAuthorizedIpcSender(event)) return;
  if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
    logStartup('[main] close-google-auth received; closing auth window');
    googleAuthWindow.close();
    googleAuthWindow = null;
  }
});

// Local SQLite storage, Google auth status, and LAN discovery IPC handlers
registerAuthorizedIpcHandlers(ipcMain, [
  ['check-google-auth-status', () => !!(googleAuthWindow && !googleAuthWindow.isDestroyed()), false],
  ['local-db:saveDraft', (_, assignmentId, studentId, code, history) => localDbAPI.saveDraft(assignmentId, studentId, code, history), false],
  ['local-db:getDraft', (_, assignmentId, studentId) => localDbAPI.getDraft(assignmentId, studentId), null],
  ['local-db:cacheClassrooms', (_, classrooms) => localDbAPI.cacheClassrooms(classrooms), false],
  ['local-db:getCachedClassrooms', () => localDbAPI.getCachedClassrooms(), []],
  ['local-db:cacheClasswork', (_, classroomId, classwork) => localDbAPI.cacheClasswork(classroomId, classwork), false],
  ['local-db:getCachedClasswork', (_, classroomId) => localDbAPI.getCachedClasswork(classroomId), []],
  ['local-db:addToSyncQueue', (_, action, url, method, body) => localDbAPI.addToSyncQueue(action, url, method, body), false],
  ['local-db:getSyncQueue', () => localDbAPI.getSyncQueue(), []],
  ['local-db:removeFromSyncQueue', (_, id) => localDbAPI.removeFromSyncQueue(id), false],
  ['local-db:setLocal', (_, key, value) => localDbAPI.setLocal(key, value), false],
  ['local-db:getLocal', (_, key) => localDbAPI.getLocal(key), null],
  ['get-discovered-server', () => getDiscoveredServer(), null],
  ['set-lan-server', async (_, serverUrl) => {
    logStartup(`[main] set-lan-server requested: ${serverUrl}`);
    if (!serverUrl) {
      await setDiscoveredServer(null);
      return { success: true, url: null };
    }
    const resolvedUrl = await resolveLanHostUrl(serverUrl, 2500);
    if (resolvedUrl) {
      await setDiscoveredServer(resolvedUrl);
      return { success: true, url: resolvedUrl };
    }
    return { success: false, error: 'Could not connect to Verity server at this address' };
  }, { success: false, error: 'Unauthorized IPC sender' }],
  ['scan-lan-servers', async () => {
    logStartup('[main] scan-lan-servers requested');
    await runDiscoveryScan(true);
    return getDiscoveredServer();
  }, null],
]);

app.on('will-quit', () => {
  logStartup('[main] app will-quit fired');
  if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
    googleAuthWindow.close();
    googleAuthWindow = null;
  }
  globalShortcut.unregisterAll();
  stopLanClient();
  stopServer();
  try { localDbAPI.close(); } catch (_) { }
  killKeyboardHook();
});
