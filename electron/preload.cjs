const { contextBridge, ipcRenderer } = require('electron');

const isAdminApp = process.env.IS_VERITY_ADMIN === 'true' || process.argv.includes('--admin-app');

if (isAdminApp) {
  try {
    contextBridge.exposeInMainWorld('IS_ADMIN_APP', true);
  } catch (_) {}
}

contextBridge.exposeInMainWorld('electronAPI', {
  isAdminApp,
  closeApp: () => ipcRenderer.send('close-app'),
  enableLockdown: (options) => ipcRenderer.send('enable-lockdown', options),
  disableLockdown: () => ipcRenderer.send('disable-lockdown'),
  getDisplayCount: () => ipcRenderer.invoke('get-display-count'),
  checkVmStatus: () => ipcRenderer.invoke('check-vm-status'),
  getCachedVmStatus: () => ipcRenderer.invoke('get-cached-vm-status'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openGoogleAuth: (url) => ipcRenderer.send('open-google-auth', url),
  closeGoogleAuth: () => ipcRenderer.send('close-google-auth'),
  checkGoogleAuthStatus: () => ipcRenderer.invoke('check-google-auth-status'),
  onGoogleAuthClosed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('google-auth-closed', handler);
    return () => ipcRenderer.removeListener('google-auth-closed', handler);
  },

  // Client-side SQLite local storage
  localDB: {
    saveDraft: (assignmentId, studentId, code, history) => 
      ipcRenderer.invoke('local-db:saveDraft', assignmentId, studentId, code, history),
    getDraft: (assignmentId, studentId) => 
      ipcRenderer.invoke('local-db:getDraft', assignmentId, studentId),
    cacheClassrooms: (classrooms) => 
      ipcRenderer.invoke('local-db:cacheClassrooms', classrooms),
    getCachedClassrooms: () => 
      ipcRenderer.invoke('local-db:getCachedClassrooms'),
    cacheClasswork: (classroomId, classwork) => 
      ipcRenderer.invoke('local-db:cacheClasswork', classroomId, classwork),
    getCachedClasswork: (classroomId) => 
      ipcRenderer.invoke('local-db:getCachedClasswork', classroomId),
    addToSyncQueue: (action, url, method, body) => 
      ipcRenderer.invoke('local-db:addToSyncQueue', action, url, method, body),
    getSyncQueue: () => 
      ipcRenderer.invoke('local-db:getSyncQueue'),
    removeFromSyncQueue: (id) => 
      ipcRenderer.invoke('local-db:removeFromSyncQueue', id),
    setLocal: (key, value) => 
      ipcRenderer.invoke('local-db:setLocal', key, value),
    getLocal: (key) => 
      ipcRenderer.invoke('local-db:getLocal', key)
  }
});
