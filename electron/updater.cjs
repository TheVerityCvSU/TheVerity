const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

let downloadedUpdatePath = null;
let currentDownloadReq = null;

function resolveFullUrl(inputUrl) {
  if (!inputUrl) return '';
  if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
    return inputUrl;
  }
  const baseUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3001';
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = inputUrl.startsWith('/') ? inputUrl : `/${inputUrl}`;
  return `${cleanBase}${cleanPath}`;
}

function downloadUpdateFile(downloadUrl, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const fullUrl = resolveFullUrl(downloadUrl);
      const tempDir = app.getPath('temp');
      const targetFile = path.join(tempDir, `TheVerity-Update-${Date.now()}.exe`);
      const fileStream = fs.createWriteStream(targetFile);

      const follow = (currentUrl, redirectCount = 0) => {
        if (redirectCount > 6) {
          fileStream.close();
          fs.unlink(targetFile, () => {});
          return reject(new Error('Too many redirects while downloading update.'));
        }

        const parsedUrl = new URL(currentUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const req = client.get(currentUrl, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, currentUrl).href;
            return follow(redirectUrl, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            fileStream.close();
            fs.unlink(targetFile, () => {});
            const msg = res.statusCode === 404
              ? 'Update installer package is not yet available on the server. Please wait for the build to finish and try again.'
              : `Update download failed with HTTP status ${res.statusCode}`;
            return reject(new Error(msg));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let transferred = 0;
          let lastReport = 0;

          res.on('data', (chunk) => {
            transferred += chunk.length;
            fileStream.write(chunk);

            const now = Date.now();
            if (now - lastReport > 100 || transferred === totalBytes) {
              lastReport = now;
              const percent = totalBytes > 0 ? Math.round((transferred / totalBytes) * 100) : 0;
              if (onProgress) {
                onProgress({
                  percent,
                  transferred,
                  total: totalBytes,
                });
              }
            }
          });

          res.on('end', () => {
            fileStream.end();
          });

          res.on('error', (err) => {
            fileStream.close();
            fs.unlink(targetFile, () => {});
            reject(err);
          });
        });

        currentDownloadReq = req;

        req.on('error', (err) => {
          fileStream.close();
          fs.unlink(targetFile, () => {});
          reject(err);
        });
      };

      fileStream.on('finish', () => {
        downloadedUpdatePath = targetFile;
        resolve(targetFile);
      });

      fileStream.on('error', (err) => {
        fs.unlink(targetFile, () => {});
        reject(err);
      });

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

    const appWorkDir = path.dirname(appExePath);
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
      '\' Wait for parent process to exit and force-terminate lingering instances',
      'WScript.Sleep 2000',
      'On Error Resume Next',
      'WshShell.Run "taskkill /F /IM ""The Verity.exe""", 0, True',
      'WshShell.Run "taskkill /F /IM ""The Verity Admin.exe""", 0, True',
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
      '    LogMsg "Warning: Target not found, checking default install paths..."',
      '    localApp = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")',
      '    userApp = localApp & "\\Programs\\The Verity\\The Verity.exe"',
      '    adminApp = localApp & "\\Programs\\The Verity Admin\\The Verity Admin.exe"',
      '    If fso.FileExists(userApp) Then',
      '        LogMsg "Launching fallback user app: " & userApp',
      '        WshShell.CurrentDirectory = localApp & "\\Programs\\The Verity"',
      '        WshShell.Run """" & userApp & """", 1, False',
      '    ElseIf fso.FileExists(adminApp) Then',
      '        LogMsg "Launching fallback admin app: " & adminApp',
      '        WshShell.CurrentDirectory = localApp & "\\Programs\\The Verity Admin"',
      '        WshShell.Run """" & adminApp & """", 1, False',
      '    End If',
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
      child.unref();
    } catch (err) {
      // Fallback: spawn installer directly
      const child = spawn(downloadedUpdatePath, ['/S', '--updated'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
    }
  } else {
    const child = spawn(downloadedUpdatePath, ['/S', '--updated'], {
      detached: true,
      stdio: 'ignore'
    });
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
