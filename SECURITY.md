# Security Policy

## Supported versions
Security fixes are developed against the latest supported release/source branch. Older snapshots may not receive fixes.

## Reporting a vulnerability
Please do not publish exploit details, credentials, private recordings or model files in a public issue. Use GitHub's **Report a vulnerability** / Security Advisories feature for this repository when available. If private reporting is unavailable, contact the repository maintainers through the contact method listed on the GitHub profile and provide only the minimum reproducible details.

## Deployment guidance
- Keep the backend on loopback for desktop-only use.
- Do not expose an unauthenticated model-upload or inference service directly to the public internet.
- Use HTTPS, authentication, firewall restrictions and trusted origins for remote access.
- Keep Python, Node.js, Android SDK and dependencies patched.
- Treat uploaded model files and voice recordings as untrusted/private data.
- Never commit credentials, personal audio or private model assets.
