# Contributing

Thanks for helping improve SafePath Bengal. This is a community-safety prototype, so accuracy, privacy, and honest status labels matter as much as code.

## Local setup

1. Install a modern browser and serve the project root over HTTP (for example, `python -m http.server 8001`).
2. Open `http://localhost:8001`. No cloud account is needed for the default demo.
3. For backend changes, install Node.js 20 or newer. Run `node backend/local-server.mjs` for the optional local API and `npm test --prefix backend` for validator tests.

## Before opening a change

- Keep sample reports visibly illustrative; never add real incident claims without a trustworthy source and review process.
- Do not commit credentials, private location data, or `backend/data/reports.local.json`.
- Keep report status changes moderator-only and validate all API input server-side.
- Avoid exact residential coordinates; maintain the rounded-location behavior.
- Test the static demo and, when relevant, the local API and Node.js tests.
- Document any AWS feature as proposed until it has been deployed and verified.

## Pull requests

Describe the user impact, privacy/security considerations, and verification performed. Include screenshots for meaningful UI changes when possible, with no personal or sensitive data visible.