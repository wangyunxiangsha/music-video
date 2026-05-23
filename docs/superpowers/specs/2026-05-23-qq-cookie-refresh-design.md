# QQ Cookie Refresh Design

## Goal

Reduce manual QQ Music Cookie copying by adding a user-confirmed QR refresh flow. Claudio should detect and update the short-lived QQ Music token without exposing raw Cookie values in the UI.

## Approach

- Keep QQ Music playback code in Node.
- Add `server/qq-login-manager.js` to own QR login session state, redacted Cookie diagnostics, `.env` update, and runtime `process.env.QQ_MUSIC_COOKIE` refresh.
- Add `scripts/qq-login-helper.py` as an optional external helper using `qqmusic-api-python` for the QQ QR login protocol.
- Add `SET` panel controls to start/cancel QR refresh and show the QR code/status.

## Data Handling

- The helper returns `musicid/musickey`.
- Node converts that into the minimal runtime Cookie:
  - `uin=o<musicid>`
  - `qqmusic_key=<musickey>`
  - `qm_keyst=<musickey>`
- The UI never displays raw token values.
- `.env` is updated locally; `.env` remains ignored by Git.

## Failure Handling

- If `qqmusic-api-python` is missing, the UI shows an install instruction.
- If QR generation, scan confirmation, or polling fails, the session moves to `error`.
- Existing QQ playback continues using the current Cookie until a new token is successfully written.

## Testing

- Unit test Cookie parsing, minimal Cookie generation, and `.env` update behavior.
- Text-level integration test API routes and settings panel controls.
- Syntax-check Node modules and the Python helper.
