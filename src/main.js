const { app, ipcMain, BrowserWindow, session, net } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');

const authManager = require('./authManager');
const trayManager = require('./trayManager');
const apiService  = require('./apiService');

app.setAppUserModelId('com.aurora.claude-usage-tracker');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

const autoLauncher = new AutoLaunch({ name: 'Claude Usage Tracker', isHidden: true });

let pollTimer = null;
let loginWindow = null;
let notchWindow = null;

const NOTCH_W = 360, NOTCH_H = 84;
const PILL_W  = 160, PILL_H  = 36;

function createNotchWindow() {
  const { screen } = require('electron');
  const sw = screen.getPrimaryDisplay().workAreaSize.width;

  notchWindow = new BrowserWindow({
    width: NOTCH_W, height: NOTCH_H,
    x: Math.round(sw / 2 - NOTCH_W / 2),
    y: 0,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  notchWindow.loadFile(path.join(__dirname, 'notch.html'));
  notchWindow.setIgnoreMouseEvents(true, { forward: true }); // pass-through by default

  // Poll cursor position in main process — no IPC feedback loop
  let hovered = false;
  setInterval(() => {
    if (!notchWindow || notchWindow.isDestroyed()) return;
    const { screen: scr } = require('electron');
    const cursor = scr.getCursorScreenPoint();
    const [wx, wy] = notchWindow.getPosition();
    const pillX = wx + (NOTCH_W - PILL_W) / 2;

    const over = cursor.x >= pillX && cursor.x <= pillX + PILL_W &&
                 cursor.y >= wy   && cursor.y <= wy + PILL_H;

    if (over !== hovered) {
      hovered = over;
      notchWindow.setIgnoreMouseEvents(!over, { forward: true });
      if (!notchWindow.isDestroyed()) {
        notchWindow.webContents.send('notch-hover', over);
      }
    }
  }, 80);
}

// ─── Polling ────────────────────────────────────────────────────────────────

async function fetchAndBroadcast() {
  try {
    const token = await authManager.getToken();
    if (!token) {
      trayManager.sendToPopup('auth-required', {});
      return;
    }

    let orgId = authManager.getOrgId();
    if (!orgId) {
      orgId = await apiService.fetchOrgs(token);
      authManager.saveOrgId(orgId);
    }

    const data = await apiService.fetchUsage(token, orgId);
    trayManager.setIconState(data);
    trayManager.sendToPopup('usage-data', data);
    // Also send to notch window
    if (notchWindow && !notchWindow.isDestroyed()) {
      notchWindow.webContents.send('usage-data', data);
    }
  } catch (err) {
    if (err.name === 'AuthError') {
      await authManager.deleteToken();
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      trayManager.sendToPopup('auth-required', {});
      // Only open login if not already open
      if (!loginWindow || loginWindow.isDestroyed()) openLoginWindow();
    } else {
      trayManager.sendToPopup('usage-error', { message: err.message });
    }
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const intervalSecs = authManager.getRefreshInterval();
  fetchAndBroadcast(); // immediate first fetch
  pollTimer = setInterval(fetchAndBroadcast, intervalSecs * 1000);
}

// ─── Login window ────────────────────────────────────────────────────────────

function openLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 480,
    height: 640,
    title: 'Sign in to Claude',
    webPreferences: { contextIsolation: true },
  });

  loginWindow.loadURL('https://claude.ai/login');

  let capturing = false;

  async function tryCaptureToken() {
    if (capturing) return;

    // Get ALL cookies from claude.ai (not just sessionKey — it might have a different name)
    const allCookies = await session.defaultSession.cookies.get({ url: 'https://claude.ai' });


    // Try sessionKey first, then any cookie that looks like a session token
    const token = allCookies.find(c => c.name === 'sessionKey' && c.value?.length > 20)?.value
                || allCookies.find(c => (c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('token')) && c.value?.length > 20)?.value;

    if (!token) {
      console.log('[Auth] No usable token cookie yet');
      return;
    }

    capturing = true;
    try {
      // Make the API call from inside the browser window — cookies are automatic
      const orgId = await loginWindow.webContents.executeJavaScript(`
        fetch('https://claude.ai/api/organizations', { credentials: 'include' })
          .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(data => {
            const org = Array.isArray(data) ? data[0] : data;
            return org.uuid || org.id || null;
          })
      `);
      if (!orgId) throw new Error('No org ID in response');
      const cookieStr = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
      await authManager.saveToken(token);
      authManager.saveOrgId(orgId);
      authManager.saveCookieStr(cookieStr);
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
      startPolling();
    } catch {
      capturing = false;
    }
  }

  // Poll every 2s — tryCaptureToken is the only gatekeeper needed
  const cookiePoll = setInterval(async () => {
    if (!loginWindow || loginWindow.isDestroyed()) { clearInterval(cookiePoll); return; }
    await tryCaptureToken();
  }, 2000);

  // Inject a visible "I'm signed in" button as a manual trigger
  loginWindow.webContents.on('did-finish-load', () => {
    loginWindow.webContents.executeJavaScript(`
      if (!document.getElementById('_tracker-btn')) {
        const b = document.createElement('button');
        b.id = '_tracker-btn';
        b.innerText = '✓ Signed in — launch tracker';
        b.style = 'position:fixed;bottom:12px;right:12px;z-index:99999;padding:8px 16px;background:#00d4aa;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
        document.body.appendChild(b);
      }
    `).catch(() => {});
  });

  loginWindow.on('closed', () => {
    clearInterval(cookiePoll);
    loginWindow = null;
  });
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.on('get-usage', () => fetchAndBroadcast());

ipcMain.on('close-popup', () => {
  const popup = trayManager.getPopup();
  if (popup) popup.hide();
});

ipcMain.on('logout', async () => {
  await authManager.deleteToken();
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  trayManager.sendToPopup('auth-required', {});
  openLoginWindow();
});

ipcMain.on('set-interval', (_, seconds) => {
  authManager.setRefreshInterval(seconds);
  startPolling();
});

ipcMain.on('set-autolaunch', async (_, enabled) => {
  authManager.setAutoLaunch(enabled);
  try {
    if (enabled) await autoLauncher.enable();
    else         await autoLauncher.disable();
  } catch (e) {
    console.error('Auto-launch error:', e.message);
  }
});

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.on('ready', async () => {
  trayManager.createTray((action) => {
    if (action === 'refresh') fetchAndBroadcast();
  });
  createNotchWindow();

  // Propagate theme changes to both windows
  trayManager.onThemeChanged((theme) => {
    if (notchWindow && !notchWindow.isDestroyed())
      notchWindow.webContents.send('set-theme', theme);
    const popup = trayManager.getPopup();
    if (popup && !popup.isDestroyed())
      popup.webContents.send('set-theme', theme);
  });

  const token = await authManager.getToken();
  if (token) {
    startPolling();
  } else {
    openLoginWindow();
  }
});

app.on('window-all-closed', (e) => e.preventDefault()); // stay in tray
