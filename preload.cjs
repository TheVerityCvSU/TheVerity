const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeApp: () => ipcRenderer.send('close-app'),
  enableLockdown: () => ipcRenderer.send('enable-lockdown'),
  disableLockdown: () => ipcRenderer.send('disable-lockdown'),
  checkVmStatus: () => ipcRenderer.invoke('check-vm-status'),
  getCachedVmStatus: () => ipcRenderer.invoke('get-cached-vm-status'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openGoogleAuth: (url) => ipcRenderer.send('open-google-auth', url),
  closeGoogleAuth: () => ipcRenderer.send('close-google-auth'),
  checkGoogleAuthStatus: () => ipcRenderer.invoke('check-google-auth-status'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onGoogleAuthClosed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('google-auth-closed', handler);
    return () => ipcRenderer.removeListener('google-auth-closed', handler);
  },
});
