const keytar = require('keytar');
const Store = require('electron-store');

const SERVICE = 'ClaudeUsageTracker';
const ACCOUNT = 'sessionKey';

const store = new Store({ name: 'config' });

async function saveToken(token) {
  await keytar.setPassword(SERVICE, ACCOUNT, token);
}

async function getToken() {
  try {
    return await keytar.getPassword(SERVICE, ACCOUNT);
  } catch {
    return null;
  }
}

async function deleteToken() {
  try {
    await keytar.deletePassword(SERVICE, ACCOUNT);
  } catch {}
  store.delete('orgId');
}

function saveOrgId(id) {
  store.set('orgId', id);
}

function getOrgId() {
  return store.get('orgId', null);
}

function saveCookieStr(str) {
  store.set('cookieStr', str);
}

function getCookieStr() {
  return store.get('cookieStr', null);
}

function getRefreshInterval() {
  return store.get('refreshInterval', 60);
}

function setRefreshInterval(seconds) {
  store.set('refreshInterval', seconds);
}

function getAutoLaunch() {
  return store.get('autoLaunch', false);
}

function setAutoLaunch(enabled) {
  store.set('autoLaunch', enabled);
}

module.exports = {
  saveToken, getToken, deleteToken,
  saveOrgId, getOrgId,
  saveCookieStr, getCookieStr,
  getRefreshInterval, setRefreshInterval,
  getAutoLaunch, setAutoLaunch,
};
