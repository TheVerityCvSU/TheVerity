const { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell, session, protocol, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { fork, spawn } = require('child_process');
const { initLocalDb, localDbAPI } = require('./local-db.cjs');
const { initStartupVmDetection, getVmStatus, getCachedVmStatusSync } = require('./vm-detect.cjs');

// Persistent diagnostic and startup logging
const logFile = path.join(os.tmpdir(), 'the-verity-startup.log');
function logStartup(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (_) {}
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
  } catch (_) {}
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
  } catch (_) {}
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
  if (!app.isPackaged) return; // dev mode: don't hijack the developer's keyboard
  if (hudProcess) return; // already started
  try {
    const exePath = path.join(process.resourcesPath, 'native', 'KioskLockHook.exe');
    lockFilePath = path.join(app.getPath('userData'), '.verity-lock');
    if (!fs.existsSync(exePath)) {
      logStartup(`[main] KioskLockHook.exe not found at ${exePath}`);
      return;
    }
    setLockedFile(false);
    hudProcess = spawn(exePath, [lockFilePath], { detached: true });
    hudProcess.on('error', (err) => logStartup(`[main] hook error (non-fatal): ${err.message}`));
    hudProcess.unref();
    logStartup('[main] Keyboard hook started for exam lockdown');
  } catch (err) {
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
    try { hudProcess.kill(); } catch (_) {}
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
  try { seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8')); } catch {}

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
      } catch (_) {}
    }

    logStartup(`[main] Forking server process: ${serverPath}`);
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, ...parsedEnv, DATA_DIR: dataDir, NODE_ENV: 'production', APP_VERSION: app.getVersion() },
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
const LOCKED_SHORTCUTS = [
  'Alt+Tab',
  'Alt+F4',
  'Alt+Escape',
  'Alt+Space',
  'Super',            // Windows key
  'Super+Tab',        // Task View
  'Meta+Tab',         // Task View (alternate key name)
  'Super+D',          // Show Desktop
  'Super+M',          // Minimize all
  'Super+E',          // File Explorer
  'Super+L',          // Lock screen
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
  'CommandOrControl+Alt+Delete',
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
      devTools: !app.isPackaged,
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
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.includes('accounts.google.com') ||
      url.includes('google.com/gsi/') ||
      url.includes('oauth2.googleapis.com') ||
      url.includes('/auth/google')
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 650,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            userAgent: CHROME_USER_AGENT,
          }
        }
      };
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
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
        if (!app.isPackaged && parsedUrl.host === 'localhost:5173') {
          return;
        }
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch (_) {}
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logStartup(`[main] mainWindow did-fail-load: code ${errorCode}, ${errorDescription}, url: ${validatedURL}`);
    if (validatedURL && validatedURL.includes('localhost:5173') && app.isPackaged) {
      const fallbackFile = path.join(__dirname, '../dist/index.html');
      logStartup(`[main] Falling back to direct loadFile: ${fallbackFile}`);
      mainWindow.loadFile(fallbackFile).catch(() => {});
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

  mainWindow.on('focus', () => {
    if (lockdownActive) mainWindow.setKiosk(true);
  });

  mainWindow.on('blur', () => {
    if (!lockdownActive) return;
    setTimeout(() => {
      if (!lockdownActive) return;
      if (BrowserWindow.getFocusedWindow()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }, 120);
  });

  mainWindow.on('minimize', (e) => {
    if (lockdownActive) {
      e.preventDefault();
      mainWindow.restore();
      mainWindow.focus();
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
  if (!mainWindow) return;
  lockdownActive = true;
  logStartup('[lockdown] enableLockdown engaged');

  try {
    if (mainWindow.webContents && mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    }
  } catch (_) {}

  mainWindow.setKiosk(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.focus();

  if (options.disableWindowsKeyAltTab !== false) {
    if (!hudProcess) {
      startKeyboardHook();
    }
    setLockedFile(true);
    for (const accel of LOCKED_SHORTCUTS) {
      try {
        globalShortcut.register(accel, () => {});
      } catch (_) {}
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
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setKiosk(false);
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
          let reqPath = decodeURIComponent(url.pathname);
          if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
          
          let file = path.join(__dirname, '../dist', reqPath);
          if (!fs.existsSync(file)) {
            file = path.join(__dirname, '../dist/index.html');
          }
          
          return net.fetch(pathToFileURL(file).href);
        }
      } catch (e) {
        logStartup(`[protocol] handle error: ${e.message}`);
      }
      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }

  createSplashWindow();

  try {
    initLocalDb(app.getPath('userData'));
    logStartup('[main] Local SQLite database initialized successfully');
  } catch (e) {
    logStartup(`[main] initLocalDb error: ${e.message}`);
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
  logStartup(`[main] enable-lockdown received: ${JSON.stringify(options || {})}`);
  enableLockdown(options);
});

ipcMain.on('disable-lockdown', () => {
  logStartup('[main] disable-lockdown received');
  disableLockdown();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-display-count', () => {
  const { screen } = require('electron');
  return screen.getAllDisplays().length;
});

ipcMain.handle('check-vm-status', async () => {
  return await getVmStatus();
});

ipcMain.handle('get-cached-vm-status', () => {
  return getCachedVmStatusSync();
});

ipcMain.on('close-app', () => {
  disableLockdown();
  app.quit();
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('open-google-auth', (event, url) => {
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
      userAgent: CHROME_USER_AGENT,
    }
  });

  googleAuthWindow.webContents.setWindowOpenHandler(({ url: childUrl }) => {
    shell.openExternal(childUrl);
    return { action: 'deny' };
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

ipcMain.on('close-google-auth', () => {
  if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
    logStartup('[main] close-google-auth received; closing auth window');
    googleAuthWindow.close();
    googleAuthWindow = null;
  }
});

ipcMain.handle('check-google-auth-status', () => {
  return !!(googleAuthWindow && !googleAuthWindow.isDestroyed());
});

// Local SQLite storage IPC handlers
ipcMain.handle('local-db:saveDraft', (_, assignmentId, studentId, code, history) => 
  localDbAPI.saveDraft(assignmentId, studentId, code, history));
ipcMain.handle('local-db:getDraft', (_, assignmentId, studentId) => 
  localDbAPI.getDraft(assignmentId, studentId));
ipcMain.handle('local-db:cacheClassrooms', (_, classrooms) => 
  localDbAPI.cacheClassrooms(classrooms));
ipcMain.handle('local-db:getCachedClassrooms', () => 
  localDbAPI.getCachedClassrooms());
ipcMain.handle('local-db:cacheClasswork', (_, classroomId, classwork) => 
  localDbAPI.cacheClasswork(classroomId, classwork));
ipcMain.handle('local-db:getCachedClasswork', (_, classroomId) => 
  localDbAPI.getCachedClasswork(classroomId));
ipcMain.handle('local-db:addToSyncQueue', (_, action, url, method, body) => 
  localDbAPI.addToSyncQueue(action, url, method, body));
ipcMain.handle('local-db:getSyncQueue', () => 
  localDbAPI.getSyncQueue());
ipcMain.handle('local-db:removeFromSyncQueue', (_, id) => 
  localDbAPI.removeFromSyncQueue(id));
ipcMain.handle('local-db:setLocal', (_, key, value) => 
  localDbAPI.setLocal(key, value));
ipcMain.handle('local-db:getLocal', (_, key) => 
  localDbAPI.getLocal(key));

app.on('will-quit', () => {
  logStartup('[main] app will-quit fired');
  if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
    googleAuthWindow.close();
    googleAuthWindow = null;
  }
  globalShortcut.unregisterAll();
  stopServer();
  killKeyboardHook();
});
