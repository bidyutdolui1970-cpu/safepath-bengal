# SafePath Bengal

**Explore Together. Report Responsibly. Build Safer Communities.**

SafePath Bengal is a community mapping prototype for exploring and submitting reports about local conditions across West Bengal, India.

## Run it

```bash
python -m http.server 8001
```

Open `http://localhost:8001` and keep the terminal running. On Windows, if `python` is not recognized, try `py -m http.server 8001`.

## Features

- Interactive Leaflet map with OpenStreetMap tiles and six report categories.
- Place search, map filters, report-text search, recent reports, and category/status analytics.
- Report form with map selection, validation, duplicate checks, dates, and optional metadata-stripped images.
- Browser-local demo mode and optional local JSON API.
- AWS SAM template for S3, CloudFront, API Gateway, Lambda, and DynamoDB.

## Safety and privacy

Reports start unverified. Included GeoJSON data is illustrative and not live. Coordinates are rounded; avoid homes and private locations. Current location requires browser permission. This is not an emergency service; use official sources for urgent decisions.

## AWS status

The SAM template is an undeployed scaffold; no AWS services have been deployed or tested. Local demo mode needs no AWS account or credentials. See `AWS_ARCHITECTURE.md` before deploying; usage may incur charges.

## Optional local API

With Node.js 20+, run `node backend/local-server.mjs`. Open `http://localhost:8001/?api=http%3A%2F%2F127.0.0.1%3A3001`. Run tests with `npm test --prefix backend`.

See `HACKATHON_SUBMISSION.md`, `DEMO_SCRIPT.md`, `CONTRIBUTING.md`, and `LICENSE` for more.# Screenshots

Add current screenshots of the map dashboard, a report popup, category analytics, and the report form here. Use fictional/demo content only; do not capture browser location, private reports, account details, or moderator tokens.
