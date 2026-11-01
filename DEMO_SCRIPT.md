# SafePath Bengal — Demo and Pitch Notes

## 30-second pitch

SafePath Bengal is a community map prototype for exploring local conditions across West Bengal. People can browse categorized reports, search a place, and submit an approximate public-location observation. The local demo needs no AWS account; included sample entries are illustrative, not live alerts.

## 2-minute demo script

**0:00–0:20 — Introduce the problem**  
"Local disruptions such as flooding or blocked roads can be difficult to understand when information is scattered. SafePath Bengal explores a map-first way to share and browse these reports."

**0:20–0:45 — Show the map**  
"Here is the interactive map. These markers are illustrative sample data for the demo, not verified live incidents. Selecting a marker opens its information."

**0:45–1:10 — Show discovery**  
"I can filter reports by category and search a place. A place query is sent to OpenStreetMap Nominatim only when I submit it."

**1:10–1:35 — Submit a report**  
"I can select a public point on the map and submit an observation. Its coordinates are rounded, and it starts unverified. In local demo mode it is stored only in this browser."

**1:35–2:00 — Explain the next phase**  
"The optional local JSON API and AWS SAM template are included. S3, CloudFront, API Gateway, Lambda, and DynamoDB are proposed and have not yet been deployed or tested."

## Screenshot checklist

Capture your own screenshots of:
- The full map with sample markers.
- A marker popup showing report details.
- The category filters and search.
- The report submission flow.
- The recent reports list after adding a demo report.

## Recording checklist

- Close unrelated browser tabs and notifications.
- Use a stable browser window size.
- Zoom in enough for text to be readable.
- Do not show passwords, account IDs, payment details, or private information.
- Say clearly that the sample incidents are illustrative.
- Do not claim AWS deployment or live emergency reporting.

## Questions judges may ask

**Is it connected to AWS now?**  
Not yet. This is a working local prototype with a documented AWS deployment plan.

**Where are reports stored?**  
In the current version, reports created by the user are stored in that browser's local storage. They are not shared with other users.

**Are the sample reports real?**  
No. They are illustrative demo data and should not be treated as current alerts.

**What would AWS add?**  
S3 and CloudFront could host the frontend. API Gateway and Lambda could handle report requests, and DynamoDB could store shared reports. These components would need implementation, testing, and cost review.

**How would you reduce false reports?**  
The prototype labels reports unverified, checks for recent duplicates, and exposes a token-protected status endpoint. A production release still needs an authenticated moderator workflow, audit history, and stronger abuse controls.
