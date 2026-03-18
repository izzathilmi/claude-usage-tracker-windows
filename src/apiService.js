'use strict';

// Use Electron's net.fetch — it uses the default session cookies automatically
// so claude.ai sees it as a real browser request
const { net } = require('electron');

const BASE_URL = 'https://claude.ai/api';

function apiFetch(url) {
  return net.fetch(url, {
    credentials: 'include',  // use the Electron session cookies
  });
}

function makeAuthError(message) {
  const err = new Error(message);
  err.name = 'AuthError';
  return err;
}

function makeNetworkError(message) {
  const err = new Error(message);
  err.name = 'NetworkError';
  return err;
}

function extractPercent(obj) {
  if (obj == null) return 0;
  if (typeof obj.utilization === 'number') return obj.utilization;
  if (typeof obj.utilization_pct === 'number') return obj.utilization_pct;
  if (typeof obj.percent === 'number') return obj.percent;
  if (typeof obj.usage_pct === 'number') return obj.usage_pct;
  if (typeof obj.tokens_used === 'number' && typeof obj.tokens_limit === 'number' && obj.tokens_limit !== 0) {
    return (obj.tokens_used / obj.tokens_limit) * 100;
  }
  return 0;
}

function extractResetAt(obj, fallbackMs) {
  if (obj == null) return new Date(Date.now() + fallbackMs);
  const raw = obj.reset_at || obj.resets_at || obj.reset_time;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(Date.now() + fallbackMs);
}

async function fetchOrgs(sessionKey) {
  let res;
  try {
    res = await apiFetch(BASE_URL + '/organizations');
  } catch (e) {
    throw makeNetworkError('Network request failed: ' + e.message);
  }

  if (res.status === 401 || res.status === 403) {
    throw makeAuthError('Authentication failed with status ' + res.status);
  }

  if (!res.ok) {
    throw makeNetworkError('Request failed with status ' + res.status);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw makeNetworkError('Failed to parse response JSON: ' + e.message);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw makeNetworkError('No organizations found in response');
  }

  return data[0].uuid;
}

async function fetchUsage(sessionKey, orgId) {
  let res;
  try {
    res = await apiFetch(BASE_URL + '/organizations/' + orgId + '/usage');
  } catch (e) {
    throw makeNetworkError('Network request failed: ' + e.message);
  }

  if (res.status === 401 || res.status === 403) {
    throw makeAuthError('Authentication failed with status ' + res.status);
  }

  if (!res.ok) {
    throw makeNetworkError('Request failed with status ' + res.status);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw makeNetworkError('Failed to parse response JSON: ' + e.message);
  }

  // Try to find session (5h) and weekly (7d) windows in the response.
  // The response may be an array of window objects or an object with named keys.
  let sessionWindow = null;
  let weeklyWindow = null;

  const SESSION_FALLBACK_MS = 5 * 60 * 60 * 1000;
  const WEEKLY_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;

  if (Array.isArray(data)) {
    for (const entry of data) {
      const w = (entry.window || entry.window_type || entry.type || '').toString().toLowerCase();
      if (!sessionWindow && (w.includes('5h') || w.includes('session') || w.includes('hour'))) sessionWindow = entry;
      if (!weeklyWindow  && (w.includes('7d') || w.includes('week'))) weeklyWindow = entry;
    }
    if (!sessionWindow && data.length > 0) sessionWindow = data[0];
    if (!weeklyWindow  && data.length > 1) weeklyWindow  = data[1];
  } else if (data && typeof data === 'object') {
    // Actual claude.ai response shape: { five_hour: {...}, seven_day: {...} }
    sessionWindow = data.five_hour || data.session || data['5h'] || null;
    weeklyWindow  = data.seven_day || data.weekly  || data['7d'] || null;
  }

  return {
    session: {
      used: extractPercent(sessionWindow),
      resetAt: extractResetAt(sessionWindow, SESSION_FALLBACK_MS)
    },
    weekly: {
      used: extractPercent(weeklyWindow),
      resetAt: extractResetAt(weeklyWindow, WEEKLY_FALLBACK_MS)
    },
    fetchedAt: new Date()
  };
}

module.exports = { fetchOrgs, fetchUsage };
