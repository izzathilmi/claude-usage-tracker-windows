const { Tray, BrowserWindow, screen, nativeImage, app } = require('electron');
const path = require('path');

const POPUP_WIDTH = 320;
const POPUP_HEIGHT = 440;

let tray = null;
let popup = null;
let currentTheme = 'color'; // 'color' | 'blue' | 'mono'

function iconPath(state) {
  return path.join(__dirname, '..', 'assets', `tray-${currentTheme}-${state}.png`);
}

let onThemeChange = null;

function setTheme(theme) {
  currentTheme = theme;
  if (onThemeChange) onThemeChange(theme);
}

function onThemeChanged(cb) { onThemeChange = cb; }

function stateFromPct(pct) {
  if (pct === null || pct === undefined) return 'green';
  if (pct < 60) return 'green';
  if (pct < 80) return 'yellow';
  if (pct < 90) return 'orange';
  return 'red';
}

function createTray(onReady) {
  tray = new Tray(iconPath('green'));
  tray.setToolTip('Claude Usage Tracker');

  popup = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popup.loadFile(path.join(__dirname, 'popup.html'));
  popup.on('blur', () => popup.hide());

  tray.on('click', () => togglePopup());
  tray.on('right-click', () => {
    const { Menu } = require('electron');
    const menu = Menu.buildFromTemplate([
      { label: 'Refresh', click: () => onReady && onReady('refresh') },
      { type: 'separator' },
      {
        label: 'Icon Theme',
        submenu: [
          { label: '🟢 Colour  (green/yellow/orange/red)', type: 'radio', checked: currentTheme === 'color',
            click: () => { setTheme('color');  onReady && onReady('refresh'); } },
          { label: '🔵 Blue    (blue/purple/amber/red)',   type: 'radio', checked: currentTheme === 'blue',
            click: () => { setTheme('blue');   onReady && onReady('refresh'); } },
          { label: '⬜ Mono    (light → dark grey)',       type: 'radio', checked: currentTheme === 'mono',
            click: () => { setTheme('mono');   onReady && onReady('refresh'); } },
        ],
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.exit(0) },
    ]);
    tray.popUpContextMenu(menu);
  });
}

function togglePopup() {
  if (popup.isVisible()) {
    popup.hide();
  } else {
    positionPopup();
    popup.show();
    popup.focus();
  }
}

function positionPopup() {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayMatching(trayBounds);
  const workArea = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2);
  let y;

  // Taskbar at bottom (typical Windows)
  if (trayBounds.y + trayBounds.height >= workArea.y + workArea.height) {
    y = workArea.y + workArea.height - POPUP_HEIGHT - 8;
  } else {
    // Taskbar at top
    y = workArea.y + 8;
  }

  // Clamp to screen edges
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - POPUP_WIDTH));

  popup.setPosition(x, y);
}

function setIconState(usageData) {
  if (!tray) return;
  const pct = usageData?.session?.used ?? null;
  const state = stateFromPct(pct);
  tray.setImage(iconPath(state));
  if (pct !== null) {
    tray.setToolTip(`Claude Usage — Session: ${Math.round(pct)}%`);
  }
}

function sendToPopup(channel, data) {
  if (popup && !popup.isDestroyed()) {
    popup.webContents.send(channel, data);
  }
}

function getPopup() { return popup; }
function getTray()  { return tray;  }

module.exports = { createTray, setIconState, sendToPopup, getPopup, getTray, setTheme, onThemeChanged };
