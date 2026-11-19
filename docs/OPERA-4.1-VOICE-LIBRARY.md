# Opera 4.1 — Voice Library

## Included

The backend serves 240 additional deterministic built-in presets, in addition to the original classic presets. The frontend provides search across preset names/descriptions and category filtering.

| Category | Intended character |
|---|---|
| Natural | Subtle, low-colouration conversational tones |
| Deep & Bass | Lower pitch, darker formants and bass-oriented EQ |
| Bright & High | Brighter upper-register processing |
| Character & Creative | Fictional, stylised, echo, chorus and synthetic effects |
| Studio & Clarity | Clean speech, narration and podcast-style dynamics |
| Radio & Broadcast | Presenter, DJ and broadcast-style EQ/compression |

## Important distinction

These are parameter presets, not individual trained neural voices. They do not contain recordings, voiceprints or model weights. A preset can change pitch, formant and the supported effect rack; neural conversion still requires an independently installed compatible model. The library does not impersonate a named real person.

## Validation

`tests/test_voice_library.py` checks the count, unique IDs/names, category coverage, pitch/formant bounds and supported effect keys.
