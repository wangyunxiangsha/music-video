const fs = require('fs');
const path = require('path');

const APP_NAME = 'Claudio FM';
const KIND = 'radio-memory';
const VERSION = 1;
const DEFAULT_STATS_FILE = path.join(__dirname, '../data/stats.json');
const DEFAULT_TASTE_FILE = path.join(__dirname, '../user/taste.md');
const DEFAULT_BACKUP_DIR = path.join(__dirname, '../data/backups');

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readTextFile(file, fallback = '') {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
}

function ensureDir(fileOrDir, isDir = false) {
  fs.mkdirSync(isDir ? fileOrDir : path.dirname(fileOrDir), { recursive: true });
}

function normalizeStats(stats = {}) {
  return {
    prefs: stats.prefs && typeof stats.prefs === 'object' && !Array.isArray(stats.prefs) ? stats.prefs : {},
    plays: Array.isArray(stats.plays) ? stats.plays : [],
    feedback: Array.isArray(stats.feedback) ? stats.feedback : [],
    dailyBriefings: Array.isArray(stats.dailyBriefings) ? stats.dailyBriefings : []
  };
}

function createMemoryExport({ statsFile = DEFAULT_STATS_FILE, tasteFile = DEFAULT_TASTE_FILE, now = new Date() } = {}) {
  const stats = normalizeStats(readJsonFile(statsFile, {}));
  return {
    app: APP_NAME,
    kind: KIND,
    version: VERSION,
    exportedAt: now.toISOString(),
    profile: {
      tasteMd: readTextFile(tasteFile, '')
    },
    stats
  };
}

function validatePackage(payload) {
  if (!payload || payload.app !== APP_NAME || payload.kind !== KIND || payload.version !== VERSION) {
    throw new Error('Invalid Claudio memory backup');
  }
  if (!payload.stats || typeof payload.stats !== 'object') {
    throw new Error('Invalid Claudio memory backup: missing stats');
  }
  return {
    profile: payload.profile && typeof payload.profile === 'object' ? payload.profile : {},
    stats: normalizeStats(payload.stats)
  };
}

function stamp(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function backupFile(file, backupDir, label, now) {
  if (!fs.existsSync(file)) return null;
  ensureDir(backupDir, true);
  const backup = path.join(backupDir, `${label}-${stamp(now)}.bak`);
  fs.copyFileSync(file, backup);
  return backup;
}

function itemKey(item = {}, fields = []) {
  if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
  for (const field of fields) {
    if (item[field]) return `${field}:${item[field]}`;
  }
  return `json:${JSON.stringify(item)}`;
}

function mergeArray(existing, incoming, fields) {
  const seen = new Set(existing.map((item) => itemKey(item, fields)));
  const imported = [];
  let skipped = 0;
  for (const item of incoming) {
    const key = itemKey(item, fields);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    imported.push(item);
  }
  return {
    items: [...imported, ...existing],
    imported: imported.length,
    skipped
  };
}

function sortByTime(items, fields) {
  return [...items].sort((a, b) => {
    const left = fields.map((field) => Number(a[field]) || 0).find(Boolean) || 0;
    const right = fields.map((field) => Number(b[field]) || 0).find(Boolean) || 0;
    return right - left;
  });
}

function importMemory(payload, {
  statsFile = DEFAULT_STATS_FILE,
  tasteFile = DEFAULT_TASTE_FILE,
  backupDir = DEFAULT_BACKUP_DIR,
  now = new Date()
} = {}) {
  const incoming = validatePackage(payload);
  const current = normalizeStats(readJsonFile(statsFile, {}));
  const backups = {
    stats: backupFile(statsFile, backupDir, 'stats', now),
    taste: backupFile(tasteFile, backupDir, 'taste', now)
  };

  const plays = mergeArray(current.plays, incoming.stats.plays, ['song_id', 'track_key']);
  const feedback = mergeArray(current.feedback, incoming.stats.feedback, ['track_key', 'created_at']);
  const dailyBriefings = mergeArray(current.dailyBriefings, incoming.stats.dailyBriefings, ['key']);
  const merged = {
    prefs: { ...current.prefs, ...incoming.stats.prefs },
    plays: sortByTime(plays.items, ['played_at', 'created_at']).slice(0, 500),
    feedback: sortByTime(feedback.items, ['created_at']).slice(0, 1000),
    dailyBriefings: sortByTime(dailyBriefings.items, ['created_at']).slice(0, 80)
  };

  ensureDir(statsFile);
  fs.writeFileSync(statsFile, JSON.stringify(merged, null, 2), 'utf8');

  if (typeof incoming.profile.tasteMd === 'string') {
    ensureDir(tasteFile);
    fs.writeFileSync(tasteFile, incoming.profile.tasteMd, 'utf8');
  }

  return {
    ok: true,
    imported: {
      plays: plays.imported,
      feedback: feedback.imported,
      dailyBriefings: dailyBriefings.imported,
      preferences: Object.keys(incoming.stats.prefs).length,
      taste: typeof incoming.profile.tasteMd === 'string' ? 1 : 0
    },
    skipped: {
      plays: plays.skipped,
      feedback: feedback.skipped,
      dailyBriefings: dailyBriefings.skipped
    },
    backups
  };
}

function exportFilename(now = new Date()) {
  return `Claudio-memory-${now.toISOString().slice(0, 10)}.claudio`;
}

module.exports = {
  APP_NAME,
  KIND,
  VERSION,
  createMemoryExport,
  importMemory,
  exportFilename
};
