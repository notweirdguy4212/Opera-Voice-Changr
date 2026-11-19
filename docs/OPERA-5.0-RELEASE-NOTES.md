# Opera Voice Changer 5.0.0 — Release notes

## Voice library expansion

- Increased the deterministic built-in processing library to **536 presets**: 16 classic presets plus 520 generated recipes.
- Added six categories: Whisper & Intimate, Classic & Retro, Game & Stream, Documentary & Audiobook, Sci-Fi & Synthetic, and Stage & Character.
- Existing search, category filters, favourites, personal presets and progressive loading continue to use the backend preset API.
- Added tests for total count, uniqueness, supported effect keys, parameter ranges and category coverage.

## Documentation and project workflow

- Replaced the brief project overview with a structured, professional README and repository map.
- Added README summaries in 15 languages total (English plus 14 translations).
- Added a practical Start Here guide, contributing guide and security policy.
- Added GitHub bug/feature issue forms, pull request checklist, Q&A discussion template, Dependabot and CodeQL analysis workflow.
- Updated package and application version metadata to 5.0.0.

## Important boundaries

- Presets are processing recipes, not separate neural voice models or voice clones.
- Neural conversion requires a compatible model and runtime; model weights are not bundled.
- Android build and device validation are still required. Android apps cannot force third-party apps to select Opera as their microphone.
- This source release does not include a signed APK.
