# Radio Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next-stage Claudio FM personalization loop: lightweight likes/dislikes first, then scene radio modes, DJ speech strategy, queue preview, and daily station openings.

**Architecture:** Keep the existing Node.js + Vanilla JS structure. Add small focused server modules for feedback, scene selection, and DJ policy, then wire them into `server/index.js` chat/next-track flow and the existing `data/stats.json` persistence. The first implementation slice should be independently useful: feedback commands must immediately affect local recommendation scoring.

**Tech Stack:** Node.js CommonJS, Express, Vanilla JS/CSS, JSON persistence in `data/stats.json`, existing Playwright visual regression.

---

## Current Context

The project already has:
- Local playlist data in `data/playlists.json`.
- Song classification in `data/categories.json` and `data/songs-classified.json`.
- Playback history and preference helpers in `server/stats.js`.
- Recommendation boosting in `server/index.js` via `boostPlaylistByTaste(pool)`.
- Natural-language command routing in `POST /api/chat`.
- History UI via the bottom `HIST` panel.

The next implementation should start with feedback because it becomes the data foundation for scene radio and DJ strategy.

Current workspace note: this directory currently does not expose a `.git` repository to the shell. Treat each task’s verification step as the checkpoint; if Git is initialized later, commit each task separately.

---

## File Map

- Modify: `server/stats.js`
  - Store structured feedback events and blocked preferences.
  - Expose `saveFeedback()`, `getFeedbackSignals()`, and `isTrackBlocked()`.
- Create: `server/feedback.js`
  - Parse user feedback commands such as “喜欢这首”, “少放这个歌手”, “别放这类”.
  - Convert commands into normalized feedback actions.
- Modify: `server/index.js`
  - Route feedback commands before regular AI chat.
  - Apply feedback signals inside `boostPlaylistByTaste(pool)`.
  - Add `GET /api/feedback` for debugging and future UI.
- Modify: `public/index.html`
  - Add compact like/dislike controls near playback controls.
- Modify: `public/app.js`
  - Send feedback actions to `/api/chat` or a dedicated endpoint.
  - Show DJ acknowledgement bubbles.
- Modify: `public/style.css`
  - Style feedback controls in the existing dark Claudio visual language.
- Modify: `readme.md`, `doc/plan.md`, `doc/summary.md`, `doc/talk.md`
  - Record the feature and supported commands.
- Test/Verify: `node --check`, `npm.cmd run test:visual`, manual `curl`/PowerShell requests.

---

### Task 1: Feedback Persistence

**Files:**
- Modify: `server/stats.js`

- [ ] **Step 1: Add feedback shape to stats loading**

Change `load()` so newly created stats include `feedback`:

```js
function load() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return {
      plays: Array.isArray(db.plays) ? db.plays : [],
      prefs: db.prefs || {},
      feedback: Array.isArray(db.feedback) ? db.feedback : []
    };
  } catch {
    return { plays: [], prefs: {}, feedback: [] };
  }
}
```

- [ ] **Step 2: Add feedback helpers**

Add these functions after `getHistorySummary()`:

```js
function normalizeTrackKey(track = {}) {
  const artist = track.artist || track.artists?.[0]?.name || track.ar?.[0]?.name || '';
  const name = track.song_name || track.name || '';
  return `${String(name).trim().toLowerCase()}::${String(artist).trim().toLowerCase()}`;
}

function saveFeedback(action) {
  const db = load();
  const entry = {
    id: Date.now(),
    type: action.type,
    target: action.target || 'track',
    value: action.value || '',
    track_id: action.track?.id ? String(action.track.id) : '',
    track_key: action.track ? normalizeTrackKey(action.track) : '',
    song_name: action.track?.name || '',
    artist: action.track?.artists?.[0]?.name || action.track?.ar?.[0]?.name || '',
    category: action.track?.categoryName || '',
    created_at: Math.floor(Date.now() / 1000)
  };
  db.feedback.unshift(entry);
  if (db.feedback.length > 500) db.feedback = db.feedback.slice(0, 500);
  save(db);
  return entry;
}

function getFeedbackSignals(limit = 200) {
  const events = load().feedback.slice(0, limit);
  return {
    likedTrackKeys: new Set(events.filter(e => e.type === 'like' && e.track_key).map(e => e.track_key)),
    dislikedTrackKeys: new Set(events.filter(e => e.type === 'dislike' && e.track_key).map(e => e.track_key)),
    blockedArtists: new Set(events.filter(e => e.type === 'block' && e.target === 'artist').map(e => e.value)),
    blockedCategories: new Set(events.filter(e => e.type === 'block' && e.target === 'category').map(e => e.value)),
    boostArtists: new Set(events.filter(e => e.type === 'boost' && e.target === 'artist').map(e => e.value)),
    reduceArtists: new Set(events.filter(e => e.type === 'reduce' && e.target === 'artist').map(e => e.value)),
    events
  };
}

function isTrackBlocked(track) {
  const signals = getFeedbackSignals();
  const artist = track?.artists?.[0]?.name || track?.ar?.[0]?.name || '';
  const category = track?.categoryName || '';
  const trackKey = normalizeTrackKey(track);
  return signals.dislikedTrackKeys.has(trackKey)
    || signals.blockedArtists.has(artist)
    || signals.blockedCategories.has(category);
}
```

- [ ] **Step 3: Export helpers**

Update `module.exports`:

```js
module.exports = {
  savePlay,
  getRecentPlays,
  getTasteSignals,
  getHistorySummary,
  savePreference,
  getPreference,
  saveFeedback,
  getFeedbackSignals,
  isTrackBlocked
};
```

- [ ] **Step 4: Verify syntax**

Run:

```bash
node --check server/stats.js
```

Expected: no output and exit code 0.

---

### Task 2: Feedback Command Parser

**Files:**
- Create: `server/feedback.js`

- [ ] **Step 1: Create parser module**

Create `server/feedback.js`:

```js
'use strict';

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

function parseFeedback(message, currentTrack) {
  const text = String(message || '').trim();
  if (!text) return null;

  const artist = currentTrack?.artists?.[0]?.name || currentTrack?.ar?.[0]?.name || '';
  const category = currentTrack?.categoryName || '';

  if (includesAny(text, ['喜欢这首', '这首不错', '好听', '多放这首'])) {
    return { type: 'like', target: 'track', track: currentTrack, reply: '收到，这首会记进你的偏好里。' };
  }

  if (includesAny(text, ['不喜欢这首', '别放这首', '跳过这首', '这首不好听'])) {
    return { type: 'dislike', target: 'track', track: currentTrack, reply: '好，这首以后会少出现。' };
  }

  if (includesAny(text, ['多放这个歌手', '多放这个人', '多来点这个歌手'])) {
    if (!artist) return null;
    return { type: 'boost', target: 'artist', value: artist, track: currentTrack, reply: `记住了，以后多放 ${artist}。` };
  }

  if (includesAny(text, ['少放这个歌手', '别放这个歌手', '不想听这个歌手'])) {
    if (!artist) return null;
    return { type: 'reduce', target: 'artist', value: artist, track: currentTrack, reply: `好，之后会少放 ${artist}。` };
  }

  if (includesAny(text, ['别放这类', '少放这种', '不想听这种'])) {
    if (!category) return null;
    return { type: 'block', target: 'category', value: category, track: currentTrack, reply: `收到，之后会避开「${category}」。` };
  }

  return null;
}

module.exports = { parseFeedback };
```

- [ ] **Step 2: Verify syntax**

Run:

```bash
node --check server/feedback.js
```

Expected: no output and exit code 0.

---

### Task 3: Wire Feedback Into Chat And Recommendation

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Require feedback parser**

Near the other requires, add:

```js
const feedback = require('./feedback');
```

- [ ] **Step 2: Route feedback before category/song/AI chat**

Inside `app.post('/api/chat', ...)`, after `const systemPrompt = await buildRuntimeContext();`, add:

```js
const feedbackAction = feedback.parseFeedback(message, currentTrack);
if (feedbackAction) {
  stats.saveFeedback(feedbackAction);
  const reply = feedbackAction.reply;
  chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
  return res.json({ reply, feedback: true, action: feedbackAction.type, target: feedbackAction.target });
}
```

This must run before `wantsNextTrack(message)` so “跳过这首” can be interpreted as dislike when phrased as feedback.

- [ ] **Step 3: Apply feedback in `boostPlaylistByTaste(pool)`**

Update the score function in `boostPlaylistByTaste(pool)`:

```js
const feedbackSignals = stats.getFeedbackSignals(200);

return [...pool]
  .filter(track => !stats.isTrackBlocked(track))
  .sort((a, b) => {
    const score = (track) => {
      const artist = track.artists?.[0]?.name || track.ar?.[0]?.name || '';
      const trackKey = `${String(track.name || '').trim().toLowerCase()}::${String(artist).trim().toLowerCase()}`;
      let s = 0;
      if (topArtists.has(artist)) s += 3;
      if (track.categoryName && topCategories.has(track.categoryName)) s += 2;
      if (feedbackSignals.likedTrackKeys.has(trackKey)) s += 5;
      if (feedbackSignals.boostArtists.has(artist)) s += 4;
      if (feedbackSignals.reduceArtists.has(artist)) s -= 4;
      if ((signals.recentSongs || []).includes(track.name)) s -= 4;
      return s + Math.random() * 0.2;
    };
    return score(b) - score(a);
  });
```

- [ ] **Step 4: Add debug endpoint**

Near other debug endpoints, add:

```js
app.get('/api/feedback', (req, res) => {
  const signals = stats.getFeedbackSignals(200);
  res.json({
    events: signals.events.slice(0, 50),
    likedTrackCount: signals.likedTrackKeys.size,
    dislikedTrackCount: signals.dislikedTrackKeys.size,
    blockedArtists: [...signals.blockedArtists],
    blockedCategories: [...signals.blockedCategories],
    boostArtists: [...signals.boostArtists],
    reduceArtists: [...signals.reduceArtists]
  });
});
```

- [ ] **Step 5: Verify syntax**

Run:

```bash
node --check server/index.js
```

Expected: no output and exit code 0.

---

### Task 4: Add Compact Feedback Controls

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add buttons in `public/index.html`**

Inside `.controls`, near previous/play/next, add two compact buttons:

```html
<button id="btn-like" class="feedback-btn" title="喜欢这首">LIKE</button>
<button id="btn-dislike" class="feedback-btn" title="少放这首">LESS</button>
```

- [ ] **Step 2: Add DOM refs in `public/app.js`**

Near other button refs:

```js
const btnLike = $('btn-like');
const btnDislike = $('btn-dislike');
```

- [ ] **Step 3: Add send helper**

Near `submitMessage()`:

```js
async function sendFeedbackCommand(message) {
  openChat(false);
  addBubble('user', message);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    if (data.reply) addBubble('dj', data.reply);
  } catch {
    addBubble('dj', '这条偏好没记上，稍后再试。');
  }
}
```

- [ ] **Step 4: Wire buttons**

After existing button handlers:

```js
if (btnLike) btnLike.onclick = () => sendFeedbackCommand('喜欢这首');
if (btnDislike) btnDislike.onclick = () => sendFeedbackCommand('少放这首');
```

- [ ] **Step 5: Add styles**

In `public/style.css`, add:

```css
.feedback-btn {
  min-width: 52px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(0,0,0,.26);
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 1px;
}

.feedback-btn:hover {
  color: var(--green);
  border-color: rgba(49,242,162,.35);
}
```

- [ ] **Step 6: Verify**

Run:

```bash
node --check public/app.js
npm.cmd run test:visual
```

Expected: JS syntax passes; visual regression passes on desktop/mobile.

---

### Task 5: Document Supported Feedback Commands

**Files:**
- Modify: `readme.md`
- Modify: `doc/plan.md`
- Modify: `doc/summary.md`
- Modify: `doc/talk.md`

- [ ] **Step 1: Add README command section**

Add supported examples:

```text
喜欢这首
这首不错
不喜欢这首
少放这个歌手
多放这个歌手
别放这类
```

- [ ] **Step 2: Update plan status**

In `doc/plan.md`, mark “喜欢 / 不喜欢反馈系统” complete after implementation verification passes.

- [ ] **Step 3: Record the stage**

In `doc/talk.md`, add a section with:
- user request
- implemented files
- verification commands
- remaining risks, especially that feedback quality depends on available playable songs

---

## Later Plan Slices

After feedback is verified, create separate implementation plans for:

1. **Scene Radio Modes**
   - Create `server/scenes.js`.
   - Map scene names to category IDs, DJ policy, and optional volume/speech hints.
   - Add commands like “深夜模式”“工作专注”“下雨安静”.

2. **DJ Speech Policy**
   - Add policy object to runtime context.
   - Control announcement frequency and length by scene.
   - Support commands like “少说话”“多介绍一点”“只播歌”.

3. **Queue Preview**
   - Add `GET /api/queue`.
   - Add `POST /api/queue/skip-next` and `POST /api/queue/rebuild`.
   - Add compact queue panel in the existing dark UI.

4. **Daily Station Opening**
   - Generate first-session greeting from time, weather, routines, and recent plays.
   - Cache one opening per day in `data/stats.json`.

---

## Verification Checklist

- [ ] `node --check server/stats.js`
- [ ] `node --check server/feedback.js`
- [ ] `node --check server/index.js`
- [ ] `node --check public/app.js`
- [ ] `npm.cmd run test:visual`
- [ ] Manual: send “喜欢这首” and confirm `/api/feedback` shows a `like` event.
- [ ] Manual: send “别放这类” on a classified song and confirm later queue excludes that category when possible.
