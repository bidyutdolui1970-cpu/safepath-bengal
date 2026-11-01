# SafePath Bengal

**Explore Together. Report Responsibly. Build Safer Communities.**

A community mapping prototype for local conditions across West Bengal, India.

> Not an emergency service. Built-in reports are illustrative, not live incidents. Use official sources for urgent decisions.

## Features

- Leaflet/OpenStreetMap map, six categories, filters, search, report details, and dashboard analytics.
- Map-selected public-location reports with validation, approximate coordinates, duplicate checks, and optional metadata-stripped photos.
- Local demo mode with browser storage and no AWS credentials.
- Optional Node.js local API and AWS SAM infrastructure scaffold.

## Run locally

Serve this directory over HTTP (for example, `python -m http.server 8001`) and open `http://localhost:8001`.

## Privacy and safety

Reports start unverified. Coordinates are rounded; avoid homes and private locations. Current location requires browser permission. Do not include sensitive details.

## AWS status

The SAM template has not been deployed or tested. AWS usage may incur charges. Local demo mode needs no AWS account or credentials. See `AWS_ARCHITECTURE.md` before deploying.

With Node.js 20+, run `node backend/local-server.mjs`; run tests with `npm test --prefix backend`.

See `HACKATHON_SUBMISSION.md`, `DEMO_SCRIPT.md`, `CONTRIBUTING.md`, and `LICENSE` for more.
