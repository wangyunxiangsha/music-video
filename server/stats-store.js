'use strict';

const fs = require('fs');
const path = require('path');

const EMPTY_STATS = {
  plays: [],
  prefs: {},
  feedback: [],
  playbackEvents: [],
  dailyBriefings: []
};

function normalizeStats(input = {}) {
  return {
    plays: Array.isArray(input.plays) ? input.plays : [],
    prefs: input.prefs && typeof input.prefs === 'object' && !Array.isArray(input.prefs) ? input.prefs : {},
    feedback: Array.isArray(input.feedback) ? input.feedback : [],
    playbackEvents: Array.isArray(input.playbackEvents) ? input.playbackEvents : [],
    dailyBriefings: Array.isArray(input.dailyBriefings) ? input.dailyBriefings : []
  };
}

function loadStats(filePath) {
  try {
    return normalizeStats(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return normalizeStats(EMPTY_STATS);
  }
}

function saveStats(filePath, stats) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalized = normalizeStats(stats);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function storageReport(filePath, stats = loadStats(filePath)) {
  const exists = fs.existsSync(filePath);
  const bytes = exists ? fs.statSync(filePath).size : 0;
  const normalized = normalizeStats(stats);
  const counts = {
    plays: normalized.plays.length,
    feedback: normalized.feedback.length,
    playbackEvents: normalized.playbackEvents.length,
    dailyBriefings: normalized.dailyBriefings.length,
    prefs: Object.keys(normalized.prefs).length
  };
  const shouldSplit = bytes > 1024 * 1024 || counts.plays > 1000 || counts.feedback > 500 || counts.playbackEvents > 1000 || counts.dailyBriefings > 100;
  return {
    path: filePath,
    exists,
    bytes,
    counts,
    recommendation: shouldSplit ? 'consider_split' : 'healthy'
  };
}

module.exports = {
  normalizeStats,
  loadStats,
  saveStats,
  storageReport
};
