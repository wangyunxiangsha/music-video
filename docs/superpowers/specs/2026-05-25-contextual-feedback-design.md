# Contextual Feedback Design

## Goal

Make Claudio FM understand feedback that is true only in the current listening scene, such as "this track is not right for work mode" or "this fits this scene", without turning that feedback into a global dislike.

## Scope

The first implementation is text-command only. It extends the existing DJ chat feedback flow and recommendation weighting. It does not add new buttons or a new settings page.

## Behavior

- When a user says "这个场景别放这首", "当前模式不适合", or similar while a track is playing, Claudio records a scene-scoped reduction for the current track.
- When a user says "这个场景适合这首" or similar, Claudio records a scene-scoped boost for the current track.
- Scene-scoped feedback stores `scene_id` and `scene_name` alongside the existing track metadata.
- Scene-scoped feedback only changes queue weighting when the active scene id matches the stored `scene_id`.
- Existing global feedback remains unchanged: `LIKE`, `LESS`, artist reduction, category blocking, temporary "不对味", and skip learning keep their current meaning.

## Data Flow

`/api/chat` passes the active scene into `feedback.parseFeedback()`. The parser returns either `scene_reduce` or `scene_boost` for scene-scoped phrases. `stats.saveFeedback()` persists the scene metadata. `stats.getFeedbackSignals()` exposes scene-scoped track sets, and `boostPlaylistByTaste()` applies them during queue ranking.

## Testing

Add a focused Node test for:

- parsing scene-scoped reduce and boost commands,
- persisting `scene_id` / `scene_name` into feedback entries,
- exposing scene-scoped signals only for the matching scene,
- leaving global dislike semantics untouched.
