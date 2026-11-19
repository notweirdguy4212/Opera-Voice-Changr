# Opera 4.3 — Voice library reliability and pagination

## Voice browsing

- The library renders the first 24 matching presets and progressively reveals another 24 with **Load more voices**.
- Search, category and collection changes reset the visible window to the first page.
- **Show fewer** collapses an expanded result set back to the first 24.
- The result count distinguishes the visible page from the total matching set.

## Connection resilience

- A successful voice-library response is cached locally in browser storage.
- If the backend becomes unreachable, the last successfully loaded built-in and personal voice list remains browsable.
- The UI identifies cached/offline data and offers a retry action. Saving and deleting personal presets still require a reachable backend.
- Overlapping refreshes are sequence-guarded so a slower, older response cannot overwrite a newer result.

## Scope and limitations

This update improves voice discovery and connection handling. It does not make the audio inference engine more intelligent or change the sound quality of an installed voice model. Presets remain DSP parameter recipes; they are not standalone neural voice models. No software can guarantee zero bugs or uninterrupted connectivity on every device/network.
