const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork, spawn } = require('child_process');
const { initStartupVmDetection, getVmStatus, getCachedVmStatusSync } = require('./electron/vm-detect.cjs');

// I-check agad pagka-start kung naka-VM para iwas daya sa exam
initStartupVmDetection(console.log);

let mainWindow;
let serverProcess = null;
let hudProcess = null; // helper para sa native keyboard hook (harang sa windows key at alt-tab)
let lockdownActive = false;

// Pag andito tong .verity-lock file, ibig sabihin naka-block si Windows key.
// Yung presence neto yung signal na "locked" si student.
// Kahit mag-crash yung app, safe pa rin kasi naka-lock pa rin hanggang ma-exit nang maayos.
let lockFilePath = null;

function startKeyboardHook() {
  if (!app.isPackaged) return; // pag dev mode wag muna i-hook baka ma-lock sarili nating keyboard habang nagko-code haha
  const exePath = path.join(process.resourcesPath, 'native', 'KioskLockHook.exe');
  lockFilePath = path.join(app.getPath('userData'), '.verity-lock');
  if (!fs.existsSync(exePath)) {
    console.error('[main] KioskLockHook.exe not found at', exePath);
    return;
  }
  setLockedFile(false); // panigurado lang na pag fresh launch, unlocked muna para di maipit
  hudProcess = spawn(exePath, [lockFilePath], { detached: true });
  hudProcess.on('error', (err) => console.error('[main] hook error:', err));
  hudProcess.unref(); // unref para di mag-hang yung buong app dahil lang sa background process na to
  console.log('[main] Keyboard hook started');
}

function setLockedFile(locked) {
  if (!lockFilePath) return;
  try {
    if (locked) {
      fs.writeFileSync(lockFilePath, String(Date.now()));
      console.log('[main] Lock file CREATED:', lockFilePath);
    } else if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
      console.log('[main] Lock file DELETED:', lockFilePath);
    }
  } catch (err) {
    console.error('[main] Could not toggle lock file:', err.message);
  }
}

function killKeyboardHook() {
  if (hudProcess && hudProcess.exitCode === null) {
    try { hudProcess.kill(); } catch (_) {}
  }
  // Burahin yung lock file para pagbukas sa susunod, normal at unlocked ulit.
  setLockedFile(false);
}

function seedDatabase(dataDir) {
  // Eto pang-seed ng default accounts (tulad ng admin@verity.com / admin) para laging
  // meron kahit bagong install, sabay merge sa mga dati nang nagawang accounts.
  const dbPath = path.join(dataDir, 'database.json');
  const seedPath = app.isPackaged
    ? path.join(process.resourcesPath, 'database.json')
    : path.join(__dirname, 'server', 'database.json');

  let current = { users: [], classwork: {}, classrooms: [], securityFlags: {} };
  if (fs.existsSync(dbPath)) {
    try { current = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch { /* pag sira or corrupt yung json, ignore lang */ }
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
      console.log(`[main] Seeded ${added} accounts into:`, dbPath);
    } catch (err) {
      console.error('[main] Could not seed database:', err.message);
    }
  }
}

function startServer() {
  // Naka-bundle na yung server via esbuild para isang CJS file na lang at walang kailangan na node_modules.
  // I-fork natin galing sa resources tapos ipasa yung DATA_DIR para sa writable location mapunta
  // yung database.json tsaka uploads folder.
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'dist-server', 'server-bundle.cjs')
    : path.join(__dirname, 'dist-server', 'server-bundle.cjs');
  const dataDir = app.isPackaged
    ? app.getPath('userData')
    : path.join(__dirname, 'server');

  if (app.isPackaged) seedDatabase(dataDir);

  serverProcess = fork(serverPath, [], {
    env: { ...process.env, DATA_DIR: dataDir, NODE_ENV: 'production', APP_VERSION: app.getVersion() },
    silent: true,
  });
  serverProcess.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  serverProcess.on('exit', (code) => {
    console.log(`[server] exited with code ${code}`);
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// Mga bawal pindutin ni student habang ongoing yung exam / lockdown
const LOCKED_SHORTCUTS = [
  'Alt+Tab',
  'Super',            // Windows key (para di makapag-start menu)
  'Super+D',
  'Super+Tab',
  'CommandOrControl+W',
  'CommandOrControl+Shift+W',
  'Alt+F4',
];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    kiosk: false, // simula muna sa unlocked window — sa exam lang ila-lockdown pag naka-login na
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (app.isPackaged) {
    // Production build: load yung index.html galing sa dist folder
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    // Dev mode: kukunin sa live Vite dev server (localhost:5173)
    mainWindow.loadURL('http://localhost:5173');
  }

  function enforceKioskTopmost() {
    if (!mainWindow || mainWindow.isDestroyed() || !lockdownActive) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  }

  // Pag biglang lumipat or nawala yung focus tapos bumalik, pilitin ulit mag-kiosk mode at i-bury ang taskbar
  mainWindow.on('focus', () => {
    if (lockdownActive) {
      mainWindow.setKiosk(true);
      enforceKioskTopmost();
    }
  });

  // Pag pumasok na sa fullscreen/kiosk, i-angat agad sa ibabaw ng taskbar
  mainWindow.on('enter-full-screen', () => {
    if (lockdownActive) {
      enforceKioskTopmost();
      setTimeout(enforceKioskTopmost, 100);
    }
  });

  // Hirap i-block ni Alt+Tab sa Windows, kaya pag nag-blur (lumipat ng window si student),
  // hihilahin natin agad pabalik yung focus dito sa app! May kaunting delay para kung sarili
  // nating dialog or popup yung binuksan, clickable pa rin yung buttons.
  mainWindow.on('blur', () => {
    if (!lockdownActive) return;
    setTimeout(() => {
      if (!lockdownActive) return;
      if (BrowserWindow.getFocusedWindow()) return; // sarili nating popup/window yung naka-focus, hayaan lang muna
      enforceKioskTopmost();
    }, 120);
  });

  // Bawal mag-minimize si student para lumusot, ibalik agad sa harap
  mainWindow.on('minimize', (e) => {
    if (lockdownActive) {
      e.preventDefault();
      enforceKioskTopmost();
    }
  });

  // Harangin yung pag-close (tulad ng Alt+F4) habang naka-lockdown pa
  mainWindow.on('close', (e) => {
    if (lockdownActive) e.preventDefault();
  });
}

function enableLockdown() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  lockdownActive = true;

  mainWindow.setFullScreen(true);
  mainWindow.setKiosk(true);
  mainWindow.setVisibleOnAllWorkspaces(true);

  // Sa Windows, minsan nauunang mag-render si taskbar kaysa sa pag-settle ng kiosk mode.
  // Re-asserting topmost right after setKiosk and via staggered delays ensures the window
  // is placed above the Windows taskbar immediately without needing an Alt+Tab cycle.
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

  // Paandarin na yung native keyboard hook para bawal ang Windows key
  setLockedFile(true);
  for (const accel of LOCKED_SHORTCUTS) {
    try {
      globalShortcut.register(accel, () => {}); // kainin lang yung shortcut para walang mangyari
    } catch (_) {
      // baka di pwede sa ibang OS yung shortcut kaya ignore lang para di mag-crash
    }
  }
}

function disableLockdown() {
  lockdownActive = false;
  globalShortcut.unregisterAll();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
  }
  // Bitawan na yung native hook at ibalik sa normal
  setLockedFile(false);
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    // Production mode: paandarin muna yung backend server tsaka keyboard hook,
    // tapos sandaling delay bago buksan yung window para sigurado naka-bind na si server sa port.
    startServer();
    startKeyboardHook();
    setTimeout(createWindow, 1500);
  } else {
    // Dev mode: bukas na agad yung window kasi tumatakbo na si server sa npm run dev
    createWindow();
  }
});

// --- Eto yung mga tawag galing sa frontend / React UI via IPC ---
ipcMain.on('enable-lockdown', () => {
  console.log('[main] enable-lockdown received');
  enableLockdown();
});
ipcMain.on('disable-lockdown', () => {
  console.log('[main] disable-lockdown received');
  disableLockdown();
});

ipcMain.handle('check-vm-status', async () => {
  return await getVmStatus();
});

ipcMain.handle('get-cached-vm-status', () => {
  return getCachedVmStatusSync();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.on('close-app', () => {
  disableLockdown(); // tanggalin muna lockdown para payagan tayo mag-quit nang maayos
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopServer();
  killKeyboardHook();
});

process.on('uncaughtException', (err) => {
  console.error('There was an uncaught error', err);
});
