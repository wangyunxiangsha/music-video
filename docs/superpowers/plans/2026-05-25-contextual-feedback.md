# Contextual Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scene-scoped track feedback so Claudio can reduce or boost a song only inside the current listening scene.

**Architecture:** Extend the existing feedback parser, stats persistence, and queue weighting path. The feature reuses `/api/chat`, `data/stats.json`, and `boostPlaylistByTaste()` instead of adding UI or new endpoints.

**Tech Stack:** Node.js, CommonJS modules, built-in `assert` tests.

---

### Task 1: Feedback Parser And Stats Signals

**Files:**
- Modify: `server/feedback.js`
- Modify: `server/stats.js`
- Test: `tests/contextual-feedback.test.js`

- [x] Write a failing test for parsing scene reduce / boost commands and extracting matching-scene signals.
- [x] Run `node tests\contextual-feedback.test.js` and confirm it fails because scene feedback is not implemented.
- [x] Extend `feedback.parseFeedback(message, currentTrack, context)` to return `scene_reduce` and `scene_boost`.
- [x] Persist `scene_id` and `scene_name` in `stats.saveFeedback()`.
- [x] Add a pure `stats.buildFeedbackSignals(events, options)` helper used by `getFeedbackSignals()`.
- [x] Run `node tests\contextual-feedback.test.js` and confirm it passes.

### Task 2: Queue Weighting Integration

**Files:**
- Modify: `server/index.js`
- Test: `tests/contextual-feedback.test.js`

- [x] Pass `activeScene` into `feedback.parseFeedback()` from `/api/chat`.
- [x] Let `boostPlaylistByTaste(pool, { scene })` request scene-aware feedback signals.
- [x] Apply `scene_reduce` as a same-scene weight penalty and `scene_boost` as a same-scene weight bonus.
- [x] Run `node --check server\index.js`.

### Task 3: Documentation And Verification

**Files:**
- Modify: `doc/plan.md`
- Modify: `doc/stage-roadmap.md`
- Modify: `doc/summary.md`
- Modify: `doc/document.md`
- Modify: `readme.md`

- [x] Document scene-scoped feedback commands in README.
- [x] Mark the stage-roadmap item complete after verification.
- [x] Run `node tests\contextual-feedback.test.js`.
- [x] Run related feedback/recommendation tests.
