const countdowns = { session: null, weekly: null };

// ── Theme palettes ───────────────────────────────────────────
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

function applyColor(el, pct) {
  const key = colorKey(pct);
  el.style.background = `linear-gradient(90deg, ${theme[key]}, ${theme[key]}cc)`;
}

// ── DOM refs ─────────────────────────────────────────────────
const pillDot      = document.getElementById('pill-dot');
const pillText     = document.getElementById('pill-text');
const pillContent  = document.getElementById('pill-content');
const expandedContent = document.getElementById('expanded-content');

const sessionBar = document.getElementById('panel-session-bar');
const sessionPct = document.getElementById('panel-session-pct');
const sessionCd  = document.getElementById('panel-session-countdown');
const weeklyBar  = document.getElementById('panel-weekly-bar');
const weeklyPct  = document.getElementById('panel-weekly-pct');
const weeklyCd   = document.getElementById('panel-weekly-countdown');

// ── Hover (sent from main process cursor polling) ────────────
const notchEl = document.getElementById('notch');
window.api.onNotchHover((isOver) => {
  notchEl.classList.toggle('expanded', isOver);
  pillContent.classList.toggle('hidden', isOver);
  expandedContent.classList.toggle('visible', isOver);
});

// ── Theme ─────────────────────────────────────────────────────
window.api.onSetTheme((name) => {
  theme = THEMES[name] || THEMES.color;
  if (lastData) renderData(lastData);
});

// ── Countdown ────────────────────────────────────────────────
function startCountdown(type, resetAtISO) {
  const el = type === 'session' ? sessionCd : weeklyCd;
  if (countdowns[type]) clearInterval(countdowns[type]);
  function tick() {
    const ms = new Date(resetAtISO) - Date.now();
    if (ms <= 0) { el.textContent = 'Resetting…'; clearInterval(countdowns[type]); return; }
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    el.textContent = h >= 24
      ? `${Math.floor(h / 24)}d ${h % 24}h`
      : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  tick();
  countdowns[type] = setInterval(tick, 1000);
}

// ── Render ───────────────────────────────────────────────────
let lastData = null;

function renderData(data) {
  const sp = data.session.used;
  const wp = data.weekly.used;
  const topKey = colorKey(Math.max(sp, wp));

  // Pill dot + text
  pillDot.style.background = theme[topKey];
  pillDot.style.boxShadow  = `0 0 6px ${theme[topKey]}bb`;
  pillText.textContent = `${Math.round(sp)}% · ${Math.round(wp)}%`;
  pillText.style.color = theme[topKey];

  // Bars + percentages
  sessionBar.style.width = sp + '%';
  sessionPct.textContent = Math.round(sp) + '%';
  sessionPct.style.color = theme[colorKey(sp)];
  applyColor(sessionBar, sp);

  weeklyBar.style.width = wp + '%';
  weeklyPct.textContent = Math.round(wp) + '%';
  weeklyPct.style.color = theme[colorKey(wp)];
  applyColor(weeklyBar, wp);
}

window.api.onUsageData((data) => {
  lastData = data;
  renderData(data);
  startCountdown('session', data.session.resetAt);
  startCountdown('weekly',  data.weekly.resetAt);
});
