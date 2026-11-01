# Demo Guide

## Start

1. Serve the project root over HTTP and open `index.html` in the browser.
2. Wait for Leaflet and map tiles to load. The default map uses the local sample GeoJSON and browser storage.
3. Keep the sample-data and emergency-service notices in view during a presentation.

## Suggested walkthrough

1. Toggle one or two categories in the left panel and open a marker popup.
2. Use the place search once; explain that the submitted query goes to OpenStreetMap Nominatim.
3. Review the category chart and verification totals.
4. Select **Report a condition**, enter a short factual description, choose a public location from the map, and submit.
5. Show the unverified status and the new marker. In local mode, reload to demonstrate browser-local persistence.
6. Use **Clear mine** only if you want to reset reports created in the current browser; the built-in sample reports remain.

## Optional API demonstration

Run `node backend/local-server.mjs` from the project root and open the app with `?api=http%3A%2F%2F127.0.0.1%3A3001`. Reports are persisted in an ignored JSON file. Set `SAFE_PATH_MODERATOR_TOKEN` directly in the terminal before starting the API if you need to demonstrate a status update; never put the token in the browser or a recording.

## Safety and privacy checklist

- State that the sample records are fictional and the app is not an emergency service.
- Use a public landmark, not a residence, when selecting a report point.
- Do not upload identifiable people, plates, or sensitive images.
- Do not show browser location, private data, cloud account details, or moderator tokens.
- AWS resources are not deployed by this repository's current state.