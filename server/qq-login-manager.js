const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ENV_FILE = path.join(__dirname, '../.env');
const HELPER_SCRIPT = path.join(__dirname, '../scripts/qq-login-helper.py');

let session = null;

function splitCookie(cookie = '') {
  return String(cookie)
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .map((item) => {
      const index = item.indexOf('=');
      return index >= 0 ? [item.slice(0, index), item.slice(index + 1)] : [item, ''];
    });
}

function cookieValue(cookie, name) {
  const found = splitCookie(cookie).find(([key]) => key === name);
  return found ? found[1] : '';
}

function serializeCookieObject(cookieObject = {}) {
  return Object.entries(cookieObject)
    .filter(([, value]) => value != null && String(value) !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function parseCookieStatus(cookie = process.env.QQ_MUSIC_COOKIE || '') {
  const pairs = splitCookie(cookie);
  const get = (name) => {
    const value = cookieValue(cookie, name);
    return { present: Boolean(value), length: value.length };
  };
  return {
    configured: Boolean(cookie),
    fieldCount: pairs.length,
    uin: get('uin'),
    qqmusicKey: get('qqmusic_key'),
    qmKeyst: get('qm_keyst'),
    psrfQqOpenid: get('psrf_qqopenid'),
    psrfQqAccessToken: get('psrf_qqaccess_token'),
    psrfQqRefreshToken: get('psrf_qqrefresh_token'),
    psrfQqUnionid: get('psrf_qqunionid'),
    musicKeyCreatedAt: get('psrf_musickey_createtime'),
    accessTokenExpiresAt: get('psrf_access_token_expiresAt'),
    names: pairs.map(([key]) => key)
  };
}

function cookieFromCredential(credential = {}) {
  const fullCookie = String(credential.cookie || credential.cookieText || credential.cookie_string || '').trim()
    || (typeof credential.cookies === 'string' ? credential.cookies.trim() : '')
    || (credential.cookies && typeof credential.cookies === 'object' ? serializeCookieObject(credential.cookies) : '');
  if (fullCookie) {
    const uin = cookieValue(fullCookie, 'uin')
      || cookieValue(fullCookie, 'qqmusic_uin')
      || cookieValue(fullCookie, 'wxuin')
      || cookieValue(fullCookie, 'p_uin');
    const musicKey = cookieValue(fullCookie, 'qm_keyst')
      || cookieValue(fullCookie, 'qqmusic_key')
      || cookieValue(fullCookie, 'music_key')
      || cookieValue(fullCookie, 'p_skey')
      || cookieValue(fullCookie, 'skey')
      || cookieValue(fullCookie, 'psrf_qqaccess_token')
      || cookieValue(fullCookie, 'psrf_qqrefresh_token')
      || cookieValue(fullCookie, 'wxrefresh_token')
      || cookieValue(fullCookie, 'wxskey');
    if (uin && musicKey) return fullCookie;
  }

  const musicid = String(credential.musicid || credential.musicId || credential.uin || '').replace(/^o/, '');
  const musickey = String(credential.musickey || credential.musicKey || credential.qqmusic_key || credential.qm_keyst || '');
  if (!musicid || !musickey) {
    throw new Error('QQ login credential missing musicid or musickey');
  }
  return [
    `uin=o${musicid}`,
    `qqmusic_key=${musickey}`,
    `qm_keyst=${musickey}`
  ].join('; ');
}

function updateEnvCookie(envFile = ENV_FILE, cookie) {
  if (!cookie) throw new Error('QQ cookie is empty');
  const line = `QQ_MUSIC_COOKIE=${cookie}`;
  let text = '';
  try {
    text = fs.readFileSync(envFile, 'utf8');
  } catch {
    text = '';
  }

  const lines = text.split(/\r?\n/);
  const index = lines.findIndex(item => item.startsWith('QQ_MUSIC_COOKIE='));
  if (index >= 0) {
    lines[index] = line;
  } else {
    if (lines.length && lines[lines.length - 1] !== '') lines.push('');
    lines.push(line);
  }
  fs.writeFileSync(envFile, lines.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf8');
  process.env.QQ_MUSIC_COOKIE = cookie;
  return { ok: true, envFile };
}

function safeSession() {
  if (!session) {
    return {
      active: false,
      status: 'idle',
      cookie: parseCookieStatus()
    };
  }
  return {
    active: Boolean(session.child && !session.done),
    status: session.status,
    message: session.message,
    qrDataUrl: session.qrDataUrl || '',
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    cookie: parseCookieStatus()
  };
}

function finishSession(status, message) {
  if (!session) return;
  if (session.timeout) {
    clearTimeout(session.timeout);
    session.timeout = null;
  }
  session.status = status;
  session.message = message || '';
  session.updatedAt = new Date().toISOString();
  session.done = true;
}

function cleanHelperMessage(message = '') {
  return String(message).trim().slice(0, 500);
}

function handleHelperEvent(event = {}) {
  if (!session || session.done) return;
  session.updatedAt = new Date().toISOString();
  if (event.type === 'qr') {
    session.status = 'waiting_scan';
    session.qrDataUrl = event.dataUrl || '';
    session.message = 'Scan with QQ Music or QQ';
    return;
  }
  if (event.type === 'status') {
    session.status = event.status || session.status;
    session.message = cleanHelperMessage(event.message) || session.message;
    return;
  }
  if (event.type === 'credential') {
    const cookie = cookieFromCredential(event.credential || event);
    updateEnvCookie(session.envFile, cookie);
    try {
      session.onCookieUpdated?.(cookie);
    } catch {}
    finishSession('done', 'QQ Music login refreshed');
    return;
  }
  if (event.type === 'error') {
    finishSession('error', cleanHelperMessage(event.message) || 'QQ login helper failed');
  }
}

function startLogin({
  python = process.env.PYTHON || 'python',
  envFile = ENV_FILE,
  helperScript = HELPER_SCRIPT,
  qrTimeoutMs = Number(process.env.QQ_LOGIN_QR_TIMEOUT_MS || 30000),
  onCookieUpdated = null
} = {}) {
  if (session?.child && !session.done) return safeSession();

  session = {
    child: null,
    done: false,
    status: 'starting',
    message: 'Starting QQ login helper',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    qrDataUrl: '',
    envFile,
    onCookieUpdated: typeof onCookieUpdated === 'function' ? onCookieUpdated : null,
    timeout: null
  };

  const child = spawn(python, [helperScript], {
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  session.child = child;
  session.timeout = setTimeout(() => {
    if (!session || session.done || session.status !== 'starting') return;
    try { child.kill(); } catch {}
    finishSession('error', 'QQ login QR generation timed out. Check network and try again.');
  }, qrTimeoutMs);
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleHelperEvent(JSON.parse(line));
      } catch {
        handleHelperEvent({ type: 'status', status: 'running', message: line.trim() });
      }
    }
  });
  child.stderr.on('data', (chunk) => {
    const message = cleanHelperMessage(chunk.toString('utf8'));
    if (message) handleHelperEvent({ type: 'status', status: 'running', message });
  });
  child.on('error', (error) => finishSession('error', cleanHelperMessage(error.message)));
  child.on('exit', (code) => {
    if (!session || session.status === 'done' || session.status === 'error') return;
    finishSession(code === 0 ? 'done' : 'error', code === 0 ? session.message : `QQ login helper exited: ${code}`);
  });
  return safeSession();
}

function cancelLogin() {
  if (session?.child && !session.done) {
    session.child.kill();
    finishSession('cancelled', 'QQ login refresh cancelled');
  }
  return safeSession();
}

module.exports = {
  parseCookieStatus,
  cookieFromCredential,
  updateEnvCookie,
  startLogin,
  cancelLogin,
  getStatus: safeSession
};
