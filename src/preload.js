const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_SEND = ['get-usage', 'logout', 'set-interval', 'set-autolaunch', 'close-popup', 'notch-mouse'];

contextBridge.exposeInMainWorld('api', {
  onUsageData:    (cb) => ipcRenderer.on('usage-data',    (_, d) => cb(d)),
  onAuthRequired: (cb) => ipcRenderer.on('auth-required', (_, d) => cb(d)),
  onError:        (cb) => ipcRenderer.on('usage-error',   (_, d) => cb(d)),
  onNotchHover:   (cb) => ipcRenderer.on('notch-hover',  (_, d) => cb(d)),
  onSetTheme:     (cb) => ipcRenderer.on('set-theme',    (_, d) => cb(d)),
  send: (channel, ...args) => {
    if (ALLOWED_SEND.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
});
