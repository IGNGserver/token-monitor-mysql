'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tokenMonitor', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  previewAppearance: (patch) => ipcRenderer.invoke('appearance:preview', patch),
  getStats: () => ipcRenderer.invoke('stats:get'),
  getStreamStatus: () => ipcRenderer.invoke('stream:status'),
  onStatsPush: (callback) => {
    const listener = (_event, payload) => { try { callback(payload); } catch (_) {} };
    ipcRenderer.on('stats:push', listener);
    return () => ipcRenderer.removeListener('stats:push', listener);
  },
  openUserData: () => ipcRenderer.invoke('app:openUserData'),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close')
});
