# SafePath Bengal — Hackathon Submission Pack

## Project summary

SafePath Bengal is a community-oriented map prototype for sharing and exploring local disruption reports, such as flooding, road blockages, public-service issues, and useful local places.

The current version is a **working local prototype**. It uses illustrative sample reports and browser-local storage. It is not a live emergency-information service, and its sample incidents are not verified real-world reports.

## Problem

During heavy rain, flooding, road closures, and other local disruptions, people may struggle to find information in one easy-to-understand place. SafePath Bengal demonstrates how a map-based community reporting interface could help people share and explore local information.

## What the prototype currently does

- Displays an interactive Leaflet map.
- Shows illustrative sample report markers.
- Supports report search and category filters.
- Lets a user select a map location and submit a report.
- Saves user-created reports in the current browser using local storage.
- Includes a recent-reports area and a responsive dark interface.

## Technology used

- HTML, CSS and JavaScript
- Leaflet map library
- OpenStreetMap map tiles
- GeoJSON sample data
- Browser `localStorage`

## AWS connection: planned, not yet deployed

This submission includes an **AWS provisioning template**, not a deployed AWS application. No AWS services have been deployed or tested from this repository.

Proposed future architecture:

1. Amazon S3 — store the static website files.
2. Amazon CloudFront — serve the site over HTTPS while keeping the S3 bucket private through Origin Access Control.
3. Amazon API Gateway — expose a report-submission and report-reading API.
4. AWS Lambda — validate and process report requests.
5. Amazon DynamoDB — store reports and their status.
6. Amazon Location Service — optional map/geospatial capabilities, subject to service availability and pricing in the chosen Region.

Do not describe these services as integrated until they have actually been configured and tested.

## Run locally

1. Extract the project ZIP.
2. Open a terminal in the folder containing `index.html`.
3. Run `python -m http.server 8000` (or `py -m http.server 8000` on Windows if needed).
4. Open `http://localhost:8000`.
5. Keep the terminal open while testing.

If port 8000 is busy, use `python -m http.server 8080` and visit `http://localhost:8080`.

## Important limitations

- Sample incidents are illustrative demo data, not live or verified alerts.
- Reports are stored only in the browser that created them.
- The optional local JSON API is not a shared database. The SAM template is not deployed; there is no user identity or moderation interface.
- The prototype must not be relied on for emergency decisions.
- Map tiles require an internet connection and are subject to the tile provider's terms and usage policy.

## Responsible-use plan

A production version should include report timestamps, clear status labels, duplicate detection, moderation, abuse reporting, privacy-conscious location handling, and a visible notice directing people to official emergency services for urgent situations. User-submitted reports should be treated as unverified until checked.

## Suggested project description

SafePath Bengal is a dark-themed, interactive community map prototype designed to demonstrate how people could share and explore local disruption reports. The MVP includes map markers, search, category filters, and browser-local report submission. It is built with HTML, CSS, JavaScript, Leaflet, GeoJSON and OpenStreetMap tiles. The current build runs locally; AWS hosting and backend services are planned future integrations, not completed features.
