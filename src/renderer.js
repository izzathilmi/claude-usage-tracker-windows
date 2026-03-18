// renderer.js — Electron renderer process
// No require() or Node/Electron imports. Communicates only via window.api.

const THEMES = {
  color: { green: '#00d4aa', yellow: '#f5a623', orange: '#e8621a', red: '#e8341a' },
  blue:  { green: '#4a9eff', yellow: '#a78bfa', orange: '#f59e0b', red: '#ef4444' },
  mono:  { green: '#cccccc', yellow: '#aaaaaa', orange: '#888888', red: '#555555' },
};
let theme = THEMES.color;

function colorKey(pct) {
  if (pct < 60) return 'green';
  if (pct < 80) return 'yellow';
  if (pct < 90) return 'orange';
  return 'red';
}

const countdowns = { session: null, weekly: null };

function updateBar(type, pct) {
  const bar   = document.getElementById(`${type}-bar`);
  const pctEl = document.getElementById(`${type}-pct`);
  if (!bar || !pctEl) return;

  const key = colorKey(pct);
  bar.style.width = `${pct}%`;
  bar.style.background = `linear-gradient(90deg, ${theme[key]}, ${theme[key]}cc)`;
  pctEl.textContent = `${Math.round(pct)}%`;
  pctEl.style.color = theme[key];
}

window.api.onSetTheme((name) => {
  theme = THEMES[name] || THEMES.color;
  // Re-apply colors to existing bars if we have data
  if (lastData) applyData(lastData);
});

function startCountdown(type, resetAtISO) {
  if (countdowns[type] !== null) {
    clearInterval(countdowns[type]);
    countdowns[type] = null;
  }

  const countdownEl = document.getElementById(`${type}-countdown`);

  countdowns[type] = setInterval(() => {
    const msRemaining = new Date(resetAtISO) - Date.now();

    if (msRemaining <= 0) {
      if (countdownEl) {
        countdownEl.textContent = 'Resetting...';
      }
      clearInterval(countdowns[type]);
      countdowns[type] = null;
      return;
    }

    const totalSeconds = Math.floor(msRemaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    if (countdownEl) {
      countdownEl.textContent = `${hh}:${mm}:${ss}`;
    }
  }, 1000);
}


let lastData = null;

function applyData(data) {
  const sp = data.session.used;
  const wp = data.weekly.used;
  updateBar('session', sp);
  updateBar('weekly', wp);

  const dot = document.getElementById('status-dot');
  if (dot) {
    const key = colorKey(Math.max(sp, wp));
    dot.style.background = theme[key];
    dot.style.boxShadow  = `0 0 6px ${theme[key]}99`;
  }
}

window.api.onUsageData((data) => {
  lastData = data;
  applyData(data);

  startCountdown('session', data.session.resetAt);
  startCountdown('weekly',  data.weekly.resetAt);

  const el = document.getElementById('last-updated');
  if (el) el.textContent = new Date(data.fetchedAt).toLocaleTimeString();

  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.classList.add('pulsing');
    setTimeout(() => appEl.classList.remove('pulsing'), 1000);
  }
});

window.api.onAuthRequired(() => {
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay) {
    authOverlay.style.display = 'flex';
  } else {
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = 'Login required';
    }

    const statusDot = document.getElementById('status-dot');
    if (statusDot) {
      statusDot.classList.remove('dot-green', 'dot-yellow', 'dot-orange', 'dot-red');
    }
  }
});

window.api.onError((data) => {
  const lastUpdatedEl = document.getElementById('last-updated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `Error: ${data.message}`;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      window.api.send('get-usage');
    });
  }

  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.api.send('close-popup');
    });
  }

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const settingsPanel = document.getElementById('settings-panel');
      if (settingsPanel) {
        if (settingsPanel.classList.contains('hidden')) {
          settingsPanel.classList.remove('hidden');
          settingsPanel.style.transform = 'translateY(0)';
        } else {
          settingsPanel.classList.add('hidden');
          settingsPanel.style.transform = '';
        }
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.api.send('logout');
    });
  }

  const intervalSelect = document.getElementById('interval-select');
  if (intervalSelect) {
    intervalSelect.addEventListener('change', (e) => {
      window.api.send('set-interval', Number(e.target.value));
    });
  }

  const autolaunchCheck = document.getElementById('autolaunch-check');
  if (autolaunchCheck) {
    autolaunchCheck.addEventListener('change', (e) => {
      window.api.send('set-autolaunch', e.target.checked);
    });
  }
});
