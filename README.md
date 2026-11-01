# SafePath Bengal

**Explore Together. Report Responsibly. Build Safer Communities.**

A community mapping prototype for exploring and submitting approximate public-location reports across West Bengal, India.

> Not an emergency service. Built-in reports are illustrative sample data, not live incidents. Use official sources for urgent decisions.

## Features

- Leaflet/OpenStreetMap map with six report categories, filters, place search, popups, and dashboard analytics.
- Report form with map-selected approximate coordinates, input validation, duplicate checks, optional metadata-stripped photos, and unverified status.
- Local demo mode with browser storage and no AWS credentials.
- Optional Node.js local API and an AWS SAM template for S3, CloudFront, API Gateway, Lambda, and DynamoDB.

## Run locally

Serve this directory over HTTP (for example, `python -m http.server 8001`) and open `http://localhost:8001`.

## AWS status

AWS resources are described by an un-deployed SAM template; no AWS integration has been deployed or tested. See `AWS_ARCHITECTURE.md` before deploying. Local demo mode requires no AWS account.

See `DEMO_SCRIPT.md`, `CONTRIBUTING.md`, and `LICENSE` for more.
