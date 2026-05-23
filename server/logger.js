'use strict';

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50
};

function normalizeLevel(value = 'info') {
  const level = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : 'info';
}

function createLogger({ level = process.env.LOG_LEVEL || 'info', sink = console } = {}) {
  const active = normalizeLevel(level);

  function enabled(target) {
    return LEVELS[target] >= LEVELS[active] && active !== 'silent';
  }

  return {
    level: active,
    debug: (...args) => { if (enabled('debug')) sink.log(...args); },
    info: (...args) => { if (enabled('info')) sink.log(...args); },
    warn: (...args) => { if (enabled('warn')) sink.warn(...args); },
    error: (...args) => { if (enabled('error')) sink.error(...args); }
  };
}

module.exports = {
  createLogger,
  normalizeLevel,
  ...createLogger()
};
