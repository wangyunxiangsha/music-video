const assert = require('assert');
const logger = require('../server/logger');

{
  const events = [];
  const log = logger.createLogger({
    level: 'warn',
    sink: {
      log: (...args) => events.push(['log', ...args]),
      warn: (...args) => events.push(['warn', ...args]),
      error: (...args) => events.push(['error', ...args])
    }
  });

  log.debug('debug message');
  log.info('info message');
  log.warn('warn message');
  log.error('error message');

  assert.deepStrictEqual(events, [
    ['warn', 'warn message'],
    ['error', 'error message']
  ]);
}

{
  const events = [];
  const log = logger.createLogger({
    level: 'debug',
    sink: { log: (...args) => events.push(args), warn: (...args) => events.push(args), error: (...args) => events.push(args) }
  });
  log.debug('debug on');
  assert.deepStrictEqual(events, [['debug on']]);
}

{
  assert.strictEqual(logger.normalizeLevel('nope'), 'info');
  assert.strictEqual(logger.normalizeLevel('SILENT'), 'silent');
}

console.log('logger tests passed');
