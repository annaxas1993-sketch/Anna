# TAXI LIDER Driver

Android driver client and Node.js/PostgreSQL API.

## Android APK
Every push to `main` builds an installable debug-signed APK and publishes it as a GitHub Release and workflow artifact. Trigger manually from Actions → Android APK Release → Run workflow.

## Map
The app uses Leaflet with an OpenStreetMap-derived CARTO dark basemap, device GPS, Photon address search (Armenia-biased), and OSRM route geometry. Public community endpoints are best-effort and are not a production SLA. For a commercial fleet, configure your own tile/geocoding/routing services or a provider with suitable terms and capacity. Displayed map attribution must remain visible.

## Server
The existing API uses PostgreSQL, JWT authentication and Socket.IO. Set `DATABASE_URL`, `JWT_SECRET`, and `ADMIN_SETUP_KEY` on the server. Start from `server/` with `npm install && npm start`. The driver app's Profile screen requires the reachable server base URL, e.g. `https://your-domain` or a reachable LAN URL. Do not use localhost unless the server runs on the same phone.

Driver registration requires name, phone, password, vehicle model, plate number and licence number. A dispatcher must approve the driver before online availability and dispatch.

## Verification status
GitHub Actions is the build verification. Real GPS accuracy, routing coverage, backend connectivity and order dispatch must still be tested on a physical Android device with a reachable configured API and database. No software can guarantee 100% GPS or address accuracy.
