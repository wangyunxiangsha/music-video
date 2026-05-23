# Playback Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add short-lived playback failure blocking and a recent playable cache so Claudio FM avoids retrying broken tracks and can recover with known-good songs.

**Architecture:** Keep playback health memory in a focused in-memory module, then inject it into existing queue selection and rebuild paths. Reuse the current playback diagnostics flow so failures and successes are recorded from the same stream endpoints already used by the app.

**Tech Stack:** Node.js CommonJS, Express, built-in `assert` tests, existing queue/playability modules.

---

## File Map

- Create `server/playback-memory.js`: pure in-memory track health store with TTL-based failure blocking and recent playable snapshots.
- Create `tests/playback-memory.test.js`: unit tests for blocking, expiry, playable cache ordering, and snapshots.
- Modify `server/playability.js`: allow callers to skip blocked tracks and prefer recent playable fallback candidates.
- Modify `tests/playability.test.js`: cover blocked-track skipping and fallback behavior.
- Modify `server/index.js`: record failures/successes into playback memory, filter smart queues, add playable fallback on rebuild, and expose memory in debug snapshots.
- Modify `tests/playback-diagnostics-integration.test.js`: assert integration hooks exist.
- Modify `doc/stage-roadmap.md` and `doc/summary.md`: record the new stability stage.

## Tasks

### Task 1: Playback Memory Module

- [ ] Write `tests/playback-memory.test.js` with failing assertions for failure TTL, success cache ordering, max cache size, and snapshot counts.
- [ ] Run `node tests\playback-memory.test.js` and confirm it fails because the module does not exist.
- [ ] Create `server/playback-memory.js` with `createPlaybackMemory()`, `recordFailure()`, `recordSuccess()`, `isBlocked()`, `filterBlocked()`, `preferPlayable()`, `snapshot()`, and `reset()`.
- [ ] Run `node tests\playback-memory.test.js` and confirm it passes.

### Task 2: Playability Selection

- [ ] Extend `tests/playability.test.js` to prove blocked candidates are skipped before URL probing and recent playable fallback candidates are tried when the main queue is exhausted.
- [ ] Run `node tests\playability.test.js` and confirm the new assertions fail.
- [ ] Update `server/playability.js` with optional `isBlocked` and `fallbackPlaylist` parameters.
- [ ] Run `node tests\playability.test.js` and confirm it passes.

### Task 3: Server Integration

- [ ] Update `server/index.js` to require playback memory and create a singleton.
- [ ] Record every handled playback failure into the memory blacklist.
- [ ] Record every successful stream response into the playable cache.
- [ ] Filter smart queues and rebuilt queues through the blacklist.
- [ ] Supply recent playable tracks as fallback candidates in `nextTrack()`.
- [ ] Include playback memory in `/api/debug/playback`.
- [ ] Update integration tests to check these hooks.

### Task 4: Documentation And Verification

- [ ] Update `doc/stage-roadmap.md` to mark short-term blacklist and local playable cache complete.
- [ ] Add a `2026-05-21` entry to `doc/summary.md`.
- [ ] Run `node tests\playback-memory.test.js`.
- [ ] Run `node tests\playability.test.js`.
- [ ] Run `node tests\playback-diagnostics.test.js`.
- [ ] Run `node tests\playback-diagnostics-integration.test.js`.
- [ ] Run `node --check server\index.js`.
- [ ] Run `node --check server\playback-memory.js`.
- [ ] Run `node --check server\playability.js`.
