# Contributing to Opera Voice Changer

Thanks for helping improve Opera. Please keep changes focused, testable and respectful of user privacy.

## Before opening an issue or pull request
- Search existing issues and pull requests.
- Use the issue templates and include exact reproduction steps.
- Never upload private recordings, model weights, API keys or personal data.
- Do not add celebrity voice clones, impersonation packs or datasets without documented consent and rights.

## Development setup
Follow [docs/START_HERE.md](docs/START_HERE.md). Use Node.js 20 and the supported Python environment.

## Checks expected for a pull request
```bash
cd frontend && npm ci && npm run lint && npm test && npm run build
cd ..
pip install -r backend/requirements-test.txt
python -m compileall -q backend
python -m pytest
```

For Android/native changes, describe the Android API level, device tested, audio route and any limitations. Do not claim real-time performance without measurements.

## Pull request checklist
- [ ] Scope and user-visible behavior are described.
- [ ] Tests added or updated.
- [ ] Lint, tests and build pass, or failures are explained.
- [ ] Documentation and translations updated where appropriate.
- [ ] No secrets, private recordings, unlicensed models or generated build artifacts committed.
- [ ] Accessibility, error states and offline behavior considered.
