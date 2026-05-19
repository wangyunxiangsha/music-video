# Queue Preview And Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a usable queue preview to Claudio FM so the user can see upcoming tracks, remove the next track, rebuild the queue, and insert a requested song at the front.

**Architecture:** Keep playback state in `server/index.js`, but move queue summarizing and editing primitives into a small pure `server/queue.js` module. Expose queue state through HTTP and WebSocket, then replace the existing static `QUEUE / 0 TRACKS` strip with compact live controls in the existing dark UI.

**Tech Stack:** Node.js CommonJS, Express, Vanilla JS/CSS, existing JSON playlist data, existing visual regression script.

---

## File Map

- Create `server/queue.js`: pure helpers for queue previews, deleting next track, rebuilding from a pool, and inserting a track.
- Create `tests/queue.test.js`: behavior tests for queue helpers.
- Modify `server/index.js`: add queue endpoints, broadcast queue snapshots, and allow user song requests to insert into the upcoming queue.
- Modify `public/index.html`: replace static queue strip with a compact live queue panel.
- Modify `public/app.js`: fetch/render queue data and call queue edit endpoints.
- Modify `public/style.css`: style the live queue panel in the Claudio visual language.
- Modify `readme.md`, `doc/plan.md`, `doc/summary.md`, `doc/talk.md`, `doc/document.md`: record the new stage and supported controls.

## Tasks

### Task 1: Queue Helper Tests And Module

- [ ] Write `tests/queue.test.js` first with assertions for five-track preview, skip-next behavior, rebuild behavior, and insert-front behavior.
- [ ] Run `node tests\queue.test.js` and confirm it fails because `server/queue.js` does not exist.
- [ ] Create `server/queue.js` with `summarizeQueue()`, `removeNext()`, `rebuildQueue()`, and `insertNext()`.
- [ ] Run `node tests\queue.test.js` and confirm it passes.

### Task 2: Backend Queue API

- [ ] Add `queue` require and queue snapshot helpers in `server/index.js`.
- [ ] Include `queue` in `/api/now`, `/stream` state messages, and track broadcasts.
- [ ] Add `GET /api/queue` returning current track, next five tracks, queue count, scene, and DJ policy.
- [ ] Add `POST /api/queue/skip-next` to remove `playlist[0]` without changing the current song.
- [ ] Add `POST /api/queue/rebuild` to rebuild from the current scene when available, otherwise local playlists.
- [ ] Add `POST /api/queue/insert` with `{ message }`, resolving an existing song request and putting it at the front of the queue.
- [ ] Run `node --check server/index.js` and the queue test.

### Task 3: Frontend Queue Panel

- [ ] Replace the static queue strip markup with a summary row, action buttons, and a short upcoming list.
- [ ] Add DOM refs and `renderQueue()` in `public/app.js`.
- [ ] Fetch `/api/queue` on startup and refresh after WebSocket state/track events.
- [ ] Wire remove-next, rebuild, and insert buttons to the new endpoints.
- [ ] Run `node --check public/app.js`.

### Task 4: Documentation And Verification

- [ ] Update README queue command/API notes.
- [ ] Mark queue preview and light editing complete in `doc/plan.md`.
- [ ] Add stage summaries to `doc/summary.md`, `doc/talk.md`, and `doc/document.md`.
- [ ] Run `node tests\queue.test.js`, syntax checks, `node tests\dj-policy.test.js`, and `npm.cmd run test:visual`.
- [ ] Commit and push the verified changes to `main`.
