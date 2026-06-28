'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DEFAULT_ENV_FILE = path.join(__dirname, '..', '.env');
const DEFAULT_NCM_BASE = `http://127.0.0.1:${process.env.NCM_PORT || 3001}`;

let state = {
  status: 'idle',
  message: '网易云音乐登录未就绪',
  qrDataUrl: '',
  key: ''
};
let pollTimer = null;

function splitCookie(cookie = '') {
  return String(cookie)
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);
}

function cookieValue(cookie = '', name) {
  const lower = `${name.toLowerCase()}=`;
  const found = splitCookie(cookie).find(part => part.toLowerCase().startsWith(lower));
  return found ? found.slice(found.indexOf('=') + 1) : '';
}

function mask(value = '') {
  return value ? { present: true, length: String(value).length } : { present: false, length: 0 };
}

function parseCookieStatus(cookie = '') {
  const parts = splitCookie(cookie);
  return {
    configured: Boolean(parts.length),
    musicU: mask(cookieValue(cookie, 'MUSIC_U')),
    csrf: mask(cookieValue(cookie, '__csrf')),
    nmtid: mask(cookieValue(cookie, 'NMTID')),
    fieldCount: parts.length
  };
}

function updateEnvCookie(envFile = DEFAULT_ENV_FILE, cookie = '') {
  if (!cookie || typeof cookie !== 'string') return { ok: false, reason: 'missing cookie' };
  const normalized = splitCookie(cookie).join('; ');
  const existing = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const line = `NETEASE_COOKIE=${normalized}`;
  const next = /^NETEASE_COOKIE=.*$/m.test(existing)
    ? existing.replace(/^NETEASE_COOKIE=.*$/m, line)
    : `${existing.replace(/\s*$/, '')}${existing.trim() ? '\n' : ''}${line}\n`;
  fs.writeFileSync(envFile, next, 'utf8');
  process.env.NETEASE_COOKIE = normalized;
  return { ok: true, cookie: parseCookieStatus(normalized) };
}

async function defaultRequest(endpoint, params = {}, ncmBase = DEFAULT_NCM_BASE) {
  const res = await axios.get(`${ncmBase}${endpoint}`, {
    params: { ...params, timestamp: Date.now() },
    timeout: 8000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  return res.data;
}

function clearPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function getStatus({ env = process.env } = {}) {
  return {
    ...state,
    cookie: parseCookieStatus(env.NETEASE_COOKIE || '')
  };
}

function finishWithCookie(cookie, { envFile, onCookieUpdated } = {}) {
  clearPoll();
  updateEnvCookie(envFile, cookie);
  if (typeof onCookieUpdated === 'function') onCookieUpdated(cookie);
  state = {
    ...state,
    status: 'done',
    message: '网易云音乐登录已刷新',
    qrDataUrl: ''
  };
}

async function pollLogin({ request, envFile, pollIntervalMs, onCookieUpdated }) {
  try {
    const data = await request('/login/qr/check', { key: state.key });
    if (data?.code === 803 && data.cookie) {
      finishWithCookie(data.cookie, { envFile, onCookieUpdated });
    } else if (data?.code === 800) {
      clearPoll();
      state = { ...state, status: 'expired', message: '网易云登录二维码已过期，请重新扫码', qrDataUrl: '' };
    } else if (data?.code === 802) {
      state = { ...state, status: 'waiting_confirm', message: '请在网易云音乐中确认登录' };
    } else if (data?.code === 801) {
      state = { ...state, status: 'waiting_scan', message: '请使用网易云音乐扫码登录' };
    }
  } catch (error) {
    clearPoll();
    state = { ...state, status: 'error', message: `网易云登录检查失败：${error.message}`, qrDataUrl: '' };
  }
  if (pollTimer && pollIntervalMs <= 0) clearPoll();
}

async function startLogin(options = {}) {
  const {
    request = defaultRequest,
    envFile = DEFAULT_ENV_FILE,
    pollIntervalMs = 2500,
    onCookieUpdated
  } = options;

  clearPoll();
  state = { status: 'starting', message: '正在生成网易云登录二维码', qrDataUrl: '', key: '' };
  try {
    const keyData = await request('/login/qr/key', {});
    const key = keyData?.data?.unikey;
    if (!key) throw new Error('missing qr key');
    const qrData = await request('/login/qr/create', { key, qrimg: true });
    const qrDataUrl = qrData?.data?.qrimg || '';
    if (!qrDataUrl) throw new Error('missing qr image');
    state = { status: 'waiting_scan', message: '请使用网易云音乐扫码登录', qrDataUrl, key };
    pollTimer = setInterval(() => {
      pollLogin({ request, envFile, pollIntervalMs, onCookieUpdated });
    }, pollIntervalMs);
    pollLogin({ request, envFile, pollIntervalMs, onCookieUpdated });
    return getStatus();
  } catch (error) {
    clearPoll();
    state = { status: 'error', message: `网易云登录启动失败：${error.message}`, qrDataUrl: '', key: '' };
    return getStatus();
  }
}

function cancelLogin() {
  clearPoll();
  state = { status: 'idle', message: '网易云音乐登录已取消', qrDataUrl: '', key: '' };
  return getStatus();
}

module.exports = {
  parseCookieStatus,
  updateEnvCookie,
  getStatus,
  startLogin,
  cancelLogin
};
