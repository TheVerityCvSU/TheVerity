const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

let downloadedUpdatePath = null;
let currentDownloadReq = null;

function resolveFullUrl(inputUrl) {
  if (!inputUrl) return '';
  if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
    return inputUrl;
  }
  let baseUrl = process.env.VITE_API_URL || process.env.API_URL;
  if (!baseUrl) {
    try {
      const { getDiscoveredServer } = require('./lan-client.cjs');
      const discovered = getDiscoveredServer();
      if (discovered) baseUrl = discovered;
    } catch (_) {}
  }
  if (!baseUrl) baseUrl = 'http://localhost:3001';
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = inputUrl.startsWith('/') ? inputUrl : `/${inputUrl}`;
  return `${cleanBase}${cleanPath}`;
}

function verifyExecutableBinary(filePath, expectedSha256) {
  const stat = fs.statSync(filePath);
  if (!stat || stat.size < 1024) {
    throw new Error('Downloaded update file is empty or too small to be a valid installer.');
  }
  if (process.platform === 'win32' && filePath.toLowerCase().endsWith('.exe')) {
    const fd = fs.openSync(filePath, 'r');
    try {
      const header = Buffer.alloc(2);
      const bytesRead = fs.readSync(fd, header, 0, 2, 0);
      if (bytesRead < 2 || header[0] !== 0x4d || header[1] !== 0x5a) {
        throw new Error('Downloaded file is not a valid Windows executable.');
      }
    } finally {
      fs.closeSync(fd);
    }
  }
  if (expectedSha256 && typeof expectedSha256 === 'string') {
    const cleanExpected = expectedSha256.trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(cleanExpected)) {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
      if (hash !== cleanExpected) {
        throw new Error(`Update checksum verification failed (expected ${cleanExpected}, got ${hash}).`);
      }
    }
  }
}

function downloadUpdateFile(downloadUrl, onProgress, expectedSha256 = null) {
  return new Promise((resolve, reject) => {
    try {
      const rawUrl = typeof downloadUrl === 'object' && downloadUrl !== null ? downloadUrl.url : downloadUrl;
      const targetSha = (typeof downloadUrl === 'object' && downloadUrl !== null ? downloadUrl.sha256 : null) || expectedSha256;
      const fullUrl = resolveFullUrl(rawUrl);
      const initialParsed = new URL(fullUrl);
      if (initialParsed.protocol !== 'http:' && initialParsed.protocol !== 'https:') {
        return reject(new Error(`Unsupported update URL protocol: ${initialParsed.protocol}`));
      }
      const startedWithHttps = initialParsed.protocol === 'https:';

      const tempDir = app.getPath('temp');
      const targetFile = path.join(tempDir, `TheVerity-Update-${Date.now()}.exe`);
      const fileStream = fs.createWriteStream(targetFile);
      let settled = false;
      let expectedBytes = 0;
      let transferredBytes = 0;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { fileStream.destroy(); } catch (_) {}
        try { fs.unlink(targetFile, () => {}); } catch (_) {}
        reject(err);
      };

      const follow = (currentUrl, redirectCount = 0) => {
        if (redirectCount > 6) {
          return fail(new Error('Too many redirects while downloading update.'));
        }

        const parsedUrl = new URL(currentUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return fail(new Error(`Blocked unsupported redirect protocol: ${parsedUrl.protocol}`));
        }
        if (startedWithHttps && parsedUrl.protocol === 'http:') {
          return fail(new Error('Blocked insecure HTTPS-to-HTTP redirect while downloading update.'));
        }
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const req = client.get(currentUrl, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume();
            const redirectUrl = new URL(res.headers.location, currentUrl).href;
            return follow(redirectUrl, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            res.resume();
            const msg = res.statusCode === 404
              ? 'Update installer package is not yet available on the server. Please wait for the build to finish and try again.'
              : `Update download failed with HTTP status ${res.statusCode}`;
            return fail(new Error(msg));
          }

          expectedBytes = parseInt(res.headers['content-length'] || '0', 10) || 0;
          transferredBytes = 0;
          let lastReport = 0;

          res.on('data', (chunk) => {
            transferredBytes += chunk.length;
            fileStream.write(chunk);

            const now = Date.now();
            if (now - lastReport > 100 || (expectedBytes > 0 && transferredBytes === expectedBytes)) {
              lastReport = now;
              const percent = expectedBytes > 0 ? Math.round((transferredBytes / expectedBytes) * 100) : 0;
              if (onProgress) {
                onProgress({
                  percent,
                  transferred: transferredBytes,
                  total: expectedBytes,
                });
              }
            }
          });

          res.on('aborted', () => fail(new Error('Update download aborted unexpectedly.')));
          res.on('end', () => {
            if (expectedBytes > 0 && transferredBytes !== expectedBytes) {
              return fail(new Error(`Incomplete update download (${transferredBytes} of ${expectedBytes} bytes).`));
            }
            fileStream.end();
          });

          res.on('error', (err) => fail(err));
        });

        currentDownloadReq = req;
        req.setTimeout(30000, () => {
          try { req.destroy(new Error('Update download timed out.')); } catch (_) {}
        });
        req.on('error', (err) => fail(err));
      };

      fileStream.on('finish', () => {
        if (settled) return;
        try {
          verifyExecutableBinary(targetFile, targetSha);
          settled = true;
          downloadedUpdatePath = targetFile;
          resolve(targetFile);
        } catch (verifyErr) {
          fail(verifyErr);
        }
      });

      fileStream.on('error', (err) => fail(err));

      follow(fullUrl);
    } catch (err) {
      reject(err);
    }
  });
}

function installDownloadedUpdate(cleanupLockdownFn) {
  if (!downloadedUpdatePath || !fs.existsSync(downloadedUpdatePath)) {
    throw new Error('Downloaded update installer not found.');
  }

  if (typeof cleanupLockdownFn === 'function') {
    try { cleanupLockdownFn(); } catch (_) {}
  }

  const isWindows = process.platform === 'win32';
  const isAdmin = process.env.IS_VERITY_ADMIN === 'true' || (Array.isArray(process.argv) && process.argv.includes('--admin-app'));

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const defaultUserExe = path.join(localAppData, 'Programs', 'The Verity', 'The Verity.exe');
    const defaultAdminExe = path.join(localAppData, 'Programs', 'The Verity Admin', 'The Verity Admin.exe');

    let appExePath = null;
    if (app.isPackaged && fs.existsSync(process.execPath)) {
      appExePath = process.execPath;
    } else if (isAdmin && fs.existsSync(defaultAdminExe)) {
      appExePath = defaultAdminExe;
    } else if (fs.existsSync(defaultUserExe)) {
      appExePath = defaultUserExe;
    } else {
      appExePath = defaultUserExe;
    }

    const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
    if (isPortable) {
      try {
        const child = spawn(downloadedUpdatePath, [], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        });
        child.on('error', () => {});
        child.unref();
      } catch (err) {
        throw new Error(`Failed to launch portable update: ${err.message}`);
      }
    } else {
      const appWorkDir = path.dirname(appExePath);
      const targetExeName = path.basename(appExePath).replace(/"/g, '');
      const tempDir = app.getPath('temp');
      const vbsPath = path.join(tempDir, `verity-apply-update-${Date.now()}.vbs`);

      const vbsContent = [
        'Set WshShell = CreateObject("WScript.Shell")',
        'Set fso = CreateObject("Scripting.FileSystemObject")',
        'tempDir = WshShell.ExpandEnvironmentStrings("%TEMP%")',
        'logPath = tempDir & "\\verity-updater.log"',
        '',
        'Sub LogMsg(msg)',
        '    On Error Resume Next',
        '    Set logFile = fso.OpenTextFile(logPath, 8, True)',
        '    logFile.WriteLine "[" & Now & "] " & msg',
        '    logFile.Close',
        'End Sub',
        '',
        'LogMsg "Update initiated (silent background runner)"',
        'LogMsg "Installer: " & WScript.Arguments(0)',
        'LogMsg "App WorkDir: " & WScript.Arguments(1)',
        'LogMsg "Target Exe: " & WScript.Arguments(2)',
        '',
        '\' Wait for parent process to exit and terminate only this app instance',
        'WScript.Sleep 2000',
        'On Error Resume Next',
        `WshShell.Run "taskkill /F /IM ""${targetExeName}""", 0, True`,
        'WScript.Sleep 1000',
        '',
        'installer = WScript.Arguments(0)',
        'workDir = WScript.Arguments(1)',
        'targetExe = WScript.Arguments(2)',
        '',
        '\' Execute the installer silently (window style 0 = completely hidden, True = wait)',
        'LogMsg "Running installer silently..."',
        'WshShell.Run """" & installer & """ /S", 0, True',
        'LogMsg "Installer finished execution."',
        '',
        '\' Wait for disk flush and relaunch the updated application',
        'WScript.Sleep 2000',
        'If fso.FileExists(targetExe) Then',
        '    LogMsg "Launching updated executable: " & targetExe',
        '    WshShell.CurrentDirectory = workDir',
        '    WshShell.Run """" & targetExe & """", 1, False',
        'Else',
        '    LogMsg "Warning: Target not found, skipping fallback launch."',
        'End If',
        '',
        '\' Clean up downloaded installer and this temporary script',
        'WScript.Sleep 2000',
        'On Error Resume Next',
        'fso.DeleteFile installer, True',
        'fso.DeleteFile WScript.ScriptFullName, True'
      ].join('\r\n');

      try {
        fs.writeFileSync(vbsPath, vbsContent, 'utf8');
        const child = spawn('wscript.exe', ['//B', '//Nologo', vbsPath, downloadedUpdatePath, appWorkDir, appExePath], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        child.on('error', () => {
          const fallbackChild = spawn(downloadedUpdatePath, ['/S', '--updated'], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          });
          fallbackChild.on('error', () => {});
          fallbackChild.unref();
        });
        child.unref();
      } catch (err) {
        const child = spawn(downloadedUpdatePath, ['/S', '--updated'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        child.on('error', () => {});
        child.unref();
      }
    }
  } else {
    const child = spawn(downloadedUpdatePath, ['/S', '--updated'], {
      detached: true,
      stdio: 'ignore'
    });
    child.on('error', () => {});
    child.unref();
  }

  setTimeout(() => {
    try { app.isQuitting = true; } catch (_) {}
    app.exit(0);
  }, 400);

  return true;
}

function registerUpdateIpc(getMainWindowFn, cleanupLockdownFn) {
  ipcMain.handle('start-app-update', async (event, downloadUrl) => {
    const win = getMainWindowFn ? getMainWindowFn() : null;
    try {
      if (!downloadUrl) throw new Error('No download URL provided.');
      const targetFile = await downloadUpdateFile(downloadUrl, (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('update-download-progress', progress);
        }
      });
      if (win && !win.isDestroyed()) {
        win.webContents.send('update-download-complete');
      }
      return { success: true, path: targetFile };
    } catch (err) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('update-download-error', err.message);
      }
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('install-app-update', () => {
    try {
      installDownloadedUpdate(cleanupLockdownFn);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  downloadUpdateFile,
  installDownloadedUpdate,
  registerUpdateIpc
};
