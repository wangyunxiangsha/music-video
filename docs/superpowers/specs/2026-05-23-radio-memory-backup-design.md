# Radio Memory Backup Design

## Goal

Add a user-facing "radio memory backup / restore" feature. Users should not need to understand JSON. The UI presents a Claudio memory file with a `.claudio` extension, while the server stores a versioned structured payload internally.

## Scope

- Export preferences, feedback, recent plays, daily briefing cache, and `user/taste.md`.
- Do not export `.env`, cookies, API keys, or platform login state.
- Do not export full playlist data in the first version.
- Restore by merging stats data and replacing `taste.md` only after backing up the existing file.

## Architecture

- `server/radio-memory.js` owns backup package creation, validation, merge, and local backup writes.
- `GET /api/memory/export` returns a downloadable `.claudio` file.
- `POST /api/memory/import` accepts the parsed backup payload and returns an import summary.
- The settings panel exposes "export memory" and "import memory" controls. The browser reads the selected `.claudio` file as text and sends parsed JSON to the server.

## Data Format

The exported file is JSON with a `.claudio` extension:

```json
{
  "app": "Claudio FM",
  "kind": "radio-memory",
  "version": 1,
  "exportedAt": "2026-05-23T00:00:00.000Z",
  "profile": {
    "tasteMd": "..."
  },
  "stats": {
    "prefs": {},
    "feedback": [],
    "plays": [],
    "dailyBriefings": []
  }
}
```

## Error Handling

- Reject invalid backup packages with a 400 response.
- Back up current `data/stats.json` and `user/taste.md` before import.
- Skip duplicate plays, feedback, and daily briefings during merge.
- Return imported and skipped counts so the UI can show a human summary.

## Testing

- Unit test export package shape and sensitive-field exclusion.
- Unit test import validation, backup creation, merge behavior, and taste replacement.
- Text-level integration tests ensure API routes and settings UI controls exist.
