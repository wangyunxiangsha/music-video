'use strict';

function normalizedDetail(event = {}) {
  return String(event.detail || event.message || '').trim().toLowerCase();
}

function isClosedResponseAbort(event = {}) {
  if (event.stage !== 'stream' || event.reason !== 'upstream_stream_error') return false;
  const detail = normalizedDetail(event);
  return detail === 'aborted' || detail.includes('premature close');
}

function shouldIgnorePlaybackFailure(event = {}) {
  return isClosedResponseAbort(event);
}

module.exports = {
  shouldIgnorePlaybackFailure
};
