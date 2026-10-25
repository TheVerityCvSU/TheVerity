process.env.IS_VERITY_ADMIN = 'true';
const { app, BrowserWindow, ipcMain, shell, session, protocol, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { fork } = require('child_process');
const { initLocalDb, localDbAPI } = require('./local-db.cjs');
const { initStartupVmDetection, getVmStatus, getCachedVmStatusSync } = require('./vm-detect.cjs');

// Persistent diagnostic and startup logging
const logFile = path.join(os.tmpdir(), 'the-verity-admin-startup.log');
function logStartup(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (_) {}
  console.log(msg);
}

logStartup('========================================================');
logStartup(`[admin-main] The Verity Admin Starting: PID ${process.pid}`);
logStartup(`[admin-main] Executable: ${process.execPath}`);
logStartup(`[admin-main] isPackaged: ${app.isPackaged}, Platform: ${process.platform}, Arch: ${process.arch}`);
logStartup(`[admin-main] Argv: ${JSON.stringify(process.argv)}`);
logStartup('========================================================');

// Startup Virtual Machine (VM) detection check
initStartupVmDetection(logStartup);

// Immediate process-level crash guards
process.on('uncaughtException', (err) => {
  logStartup(`[admin-main] FATAL uncaughtException: ${err?.stack || err?.message || err}`);
  try {
    dialog.showErrorBox(
      'The Verity Admin - Startup Error',
      `A fatal error occurred:\n\n${err?.message || err}\n\nDiagnostic log written to:\n${logFile}`
    );
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  logStartup(`[admin-main] Unhandled Promise Rejection: ${reason?.stack || reason?.message || reason}`);
});

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logStartup('[admin-main] Single instance lock failed. Another instance of The Verity Admin is already running.');
  try {
    dialog.showErrorBox(
      'The Verity Admin is Already Running',
      'Another instance of The Verity Admin is already running on this computer.\n\n' +
      'Please open Windows Task Manager (Ctrl + Shift + Esc), close any existing "The Verity Admin" processes, and try launching again.'
    );
  } catch (_) {}
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  logStartup('[admin-main] Second instance launched; focusing active window');
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
app.name = 'The Verity Admin';
if (process.platform === 'win32') {
  app.setAppUserModelId('com.verity.admin.app');
}
app.userAgentFallback = CHROME_USER_AGENT;

let mainWindow;
let splashWindow = null;
let googleAuthWindow = null;
let serverProcess = null;

function seedDatabase(dataDir) {
  const dbPath = path.join(dataDir, 'database.json');
  const seedPath = app.isPackaged
    ? path.join(process.resourcesPath, 'database.json')
    : path.join(__dirname, '..', 'server', 'database.json');

  let current = { users: [], admin_users: [], classwork: {}, classrooms: [], securityFlags: {} };
  if (fs.existsSync(dbPath)) {
    try { current = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch { /* corrupt */ }
  }
  let seedData = { users: [], admin_users: [] };
  try { seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8')); } catch {}

  let added = 0;
  if (!current.admin_users) current.admin_users = [];
  const existingAdminEmails = new Set(current.admin_users.map((u) => u.email));
  for (const u of (seedData.admin_users || [])) {
    if (!existingAdminEmails.has(u.email)) {
      current.admin_users.push(u);
      added++;
    }
  }

  if (added > 0) {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
      logStartup(`[admin-main] Seeded ${added} admin accounts into: ${dbPath}`);
    } catch (err) {
      logStartup(`[admin-main] Could not seed database: ${err.message}`);
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
      logStartup(`[admin-main] server-bundle.cjs not found at ${serverPath}`);
      return;
    }

    if (app.isPackaged) {
      try {
        seedDatabase(dataDir);
      } catch (seedErr) {
        logStartup(`[admin-main] seedDatabase notice: ${seedErr.message}`);
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

    logStartup(`[admin-main] Forking server process: ${serverPath}`);
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, ...parsedEnv, DATA_DIR: dataDir, NODE_ENV: 'production', IS_ADMIN_APP: 'true', IS_LAN_HOST: 'true', APP_VERSION: app.getVersion() },
      silent: true,
    });
    serverProcess.stdout.on('data', (d) => {
      const s = d.toString().trim();
      if (s) logStartup(`[admin-server] ${s}`);
    });
    serverProcess.stderr.on('data', (d) => {
      const s = d.toString().trim();
      if (s) logStartup(`[admin-server-err] ${s}`);
    });
    serverProcess.on('exit', (code, signal) => {
      logStartup(`[admin-server] exited with code ${code}, signal ${signal}`);
      serverProcess = null;
    });
  } catch (err) {
    logStartup(`[admin-main] startServer error (non-fatal): ${err.message}`);
  }
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

function createSplashWindow() {
  logStartup('[admin-main] Creating splash window...');
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
    logStartup(`[admin-main] splashWindow.loadFile error: ${err.message}`);
  });
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow() {
  logStartup('[admin-main] Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    icon: path.join(__dirname, 'assets', 'icon-admin.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: ['--admin-app'],
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !app.isPackaged,
    },
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
    logStartup('[admin-main] Child window created from mainWindow webContents');
    childWindow.on('closed', () => {
      logStartup('[admin-main] Child window closed, notifying google-auth-closed');
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
    logStartup(`[admin-main] mainWindow did-fail-load: code ${errorCode}, ${errorDescription}, url: ${validatedURL}`);
    launchMainWindow();
    dialog.showErrorBox(
      'The Verity Admin - Loading Error',
      `Could not load user interface from ${validatedURL}.\n\nError: ${errorDescription} (${errorCode})\n\nLog saved to:\n${logFile}`
    );
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logStartup(`[admin-main] mainWindow render-process-gone: ${JSON.stringify(details)}`);
  });

  const launchMainWindow = () => {
    if (!mainWindow) return;
    logStartup('[admin-main] Revealing mainWindow and closing splashWindow');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  };

  const targetUrl = 'http://localhost:5173/?admin=true#/admin';
  logStartup(`[admin-main] mainWindow loading ${targetUrl}...`);
  mainWindow.loadURL(targetUrl).catch((err) => {
    logStartup(`[admin-main] mainWindow.loadURL failed: ${err.message}`);
    launchMainWindow();
  });

  const splashStartTime = Date.now();
  mainWindow.once('ready-to-show', () => {
    logStartup('[admin-main] mainWindow ready-to-show event fired');
    const elapsed = Date.now() - splashStartTime;
    const remainingDelay = Math.max(0, 1500 - elapsed);
    setTimeout(launchMainWindow, remainingDelay);
  });

  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      logStartup('[admin-main] Splash fallback timeout (3500ms) triggered - forcing mainWindow reveal');
      launchMainWindow();
    }
  }, 3500);
}

// App lifecycle
app.whenReady().then(() => {
  logStartup('[admin-main] app.whenReady fired');

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
          if (reqPath === '/' || reqPath === '' || reqPath.startsWith('/admin')) reqPath = '/index.html';
          
          let file = path.join(__dirname, '../dist', reqPath);
          if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            file = path.join(__dirname, '../dist/index.html');
          }
          
          return net.fetch(pathToFileURL(file).href);
        }
      } catch (e) {
        logStartup(`[admin-main] protocol handle error: ${e.message}`);
      }
      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }

  const dataDir = app.isPackaged
    ? app.getPath('userData')
    : path.join(__dirname, '..', 'server');

  try {
    initLocalDb(dataDir);
    logStartup('[admin-main] Local SQLite database initialized successfully');
  } catch (err) {
    logStartup(`[admin-main] Local SQLite database initialization failed: ${err.message}`);
  }

  startServer();
  createSplashWindow();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// IPC Handlers
ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('open-google-auth', (event, url) => {
  logStartup(`[admin-main] open-google-auth requested: ${url}`);
  if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
    googleAuthWindow.focus();
    return;
  }

  googleAuthWindow = new BrowserWindow({
    width: 520,
    height: 650,
    title: 'Sign in with Google - The Verity Admin',
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
    logStartup(`[admin-main] googleAuthWindow loadURL error: ${err.message}`);
  });

  googleAuthWindow.on('closed', () => {
    logStartup('[admin-main] googleAuthWindow closed by user');
    googleAuthWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('google-auth-closed');
    }
  });
});

ipcMain.on('close-google-auth', () => {
  if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
    logStartup('[admin-main] close-google-auth received; closing auth window');
    googleAuthWindow.close();
    googleAuthWindow = null;
  }
});

ipcMain.handle('check-google-auth-status', () => {
  return !!(googleAuthWindow && !googleAuthWindow.isDestroyed());
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

const { registerUpdateIpc } = require('./updater.cjs');
registerUpdateIpc(() => mainWindow);

ipcMain.handle('check-vm-status', async () => {
  return await getVmStatus();
});

ipcMain.handle('get-cached-vm-status', () => {
  return getCachedVmStatusSync();
});

// IPC Handler for client-side local database
ipcMain.handle('local-db:saveDraft', (event, assignmentId, studentId, code, history) => {
  return localDbAPI.saveDraft(assignmentId, studentId, code, history);
});
ipcMain.handle('local-db:getDraft', (event, assignmentId, studentId) => {
  return localDbAPI.getDraft(assignmentId, studentId);
});
ipcMain.handle('local-db:cacheClassrooms', (event, classrooms) => {
  return localDbAPI.cacheClassrooms(classrooms);
});
ipcMain.handle('local-db:getCachedClassrooms', () => {
  return localDbAPI.getCachedClassrooms();
});
ipcMain.handle('local-db:cacheClasswork', (event, classroomId, classwork) => {
  return localDbAPI.cacheClasswork(classroomId, classwork);
});
ipcMain.handle('local-db:getCachedClasswork', (event, classroomId) => {
  return localDbAPI.getCachedClasswork(classroomId);
});
ipcMain.handle('local-db:addToSyncQueue', (event, action, url, method, body) => {
  return localDbAPI.addToSyncQueue(action, url, method, body);
});
ipcMain.handle('local-db:getSyncQueue', () => {
  return localDbAPI.getSyncQueue();
});
ipcMain.handle('local-db:removeFromSyncQueue', (event, id) => {
  return localDbAPI.removeFromSyncQueue(id);
});
ipcMain.handle('local-db:setLocal', (event, key, value) => {
  return localDbAPI.setLocal(key, value);
});
ipcMain.handle('local-db:getLocal', (event, key) => {
  return localDbAPI.getLocal(key);
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
    googleAuthWindow.close();
    googleAuthWindow = null;
  }
  stopServer();
});
