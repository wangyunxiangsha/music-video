# Daily Station Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily/time-slot station briefing that greets the user with a context-aware opening based on time, weather, routines, and listening history.

**Architecture:** Add a focused `server/daily-station.js` module for slot detection, cache keys, fallback copy, and briefing creation. Persist generated briefings in `data/stats.json` through small `server/stats.js` helpers, then expose the current briefing through `/api/daily-briefing`, `/api/now`, and WebSocket state.

**Tech Stack:** Node.js CommonJS, Express, Vanilla JS/CSS, existing DeepSeek adapter with local fallback, JSON persistence.

---

## File Map

- Create `server/daily-station.js`: time-slot detection, cache key generation, fallback briefing copy, async briefing orchestration.
- Create `tests/daily-station.test.js`: slot, cache, and fallback behavior tests.
- Modify `server/stats.js`: persist and retrieve daily briefing entries.
- Modify `server/index.js`: load daily briefing for startup/API/WebSocket and send it to the frontend.
- Modify `server/ai.js`: add `generateDailyBriefing()` with API and template fallback.
- Modify `public/app.js`: show the briefing once as a DJ bubble/typewriter text when received.
- Modify documentation files in `readme.md` and `doc/`.

## Tasks

### Task 1: TDD The Daily Station Module

- [ ] Create `tests/daily-station.test.js` that requires `server/daily-station.js`.
- [ ] Assert `getTimeSlot()` maps 08:00 to morning, 10:00 to work, 12:30 to noon, 15:00 to afternoon, 21:00 to evening, and 23:30 to sleep.
- [ ] Assert `getBriefingKey()` returns the same key for the same day and slot, but a different key for a different slot.
- [ ] Assert `fallbackBriefing()` includes the slot label and weather/history hints when provided.
- [ ] Run `node tests\daily-station.test.js` and confirm it fails because the module does not exist.
- [ ] Implement the minimal module and rerun the test to green.

### Task 2: Persistence And AI Generation

- [ ] Add `saveDailyBriefing(entry)` and `getDailyBriefing(key)` to `server/stats.js`.
- [ ] Add `generateDailyBriefing(input)` to `server/ai.js`, using DeepSeek when available and local fallback when unavailable.
- [ ] Extend `server/daily-station.js` with `getOrCreateBriefing({ now, weather, routinesText, tasteSignals, recentPlays, stats, ai })`.
- [ ] Add tests for cache reuse with fake `stats` and `ai`.

### Task 3: Backend API Integration

- [ ] Add a module-level `dailyBriefing` state in `server/index.js`.
- [ ] Read `user/routines.md` and pass routines/weather/history into daily briefing generation.
- [ ] Include `dailyBriefing` in WebSocket initial state and `/api/now`.
- [ ] Add `GET /api/daily-briefing` to return the current generated briefing.
- [ ] Trigger briefing creation during startup after playlist/weather context is available.

### Task 4: Frontend Integration

- [ ] Add `dailyBriefingShown` state in `public/app.js`.
- [ ] When `/api/now` or WebSocket state includes `dailyBriefing`, render it once through the DJ text and chat bubble.
- [ ] Avoid repeating the same briefing on every WebSocket reconnect.

### Task 5: Documentation And Verification

- [ ] Update `readme.md` with the new briefing behavior and API.
- [ ] Mark每日私人电台简报 complete in `doc/plan.md`.
- [ ] Record implementation in `doc/summary.md`, `doc/talk.md`, `doc/document.md`, and any relevant standard notes.
- [ ] Run `node tests\daily-station.test.js`, `node tests\queue.test.js`, `node tests\dj-policy.test.js`, syntax checks, and visual regression.
- [ ] Commit and push the verified changes.
