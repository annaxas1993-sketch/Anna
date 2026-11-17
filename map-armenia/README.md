# Qartez Armenia — self-hosted map

This is a separate map-only Expo app and self-hosted raster tile server for Armenia. It does not modify the existing TAXI LIDER app.

## Server requirements

Use a Linux VPS with Docker Engine and Docker Compose. Importing/rendering OSM data is resource-intensive; plan for at least 4 CPU cores, 8 GB RAM and 50 GB free disk as a practical starting point. Actual requirements vary with the renderer and future usage. A public server also needs a domain and HTTPS before production use.

## Build the Armenia tile database

From this directory on the server:

```bash
chmod +x server-setup.sh
./server-setup.sh
```

The script downloads the Armenia extract from Geofabrik and imports it into the OpenStreetMap tile-server container. Initial import can take a while. The tile endpoint is:

```
http://YOUR_SERVER_IP:8080/tile/{z}/{x}/{y}.png
```

Put the server behind HTTPS (for example, with Caddy or Nginx) before using it publicly. Do not expose an unprotected production server directly.

## Connect the mobile app

In `App.js`, replace:

```js
const MAP_SERVER = "https://YOUR-ARMENIA-MAP-SERVER";
```

with your own HTTPS domain, for example `https://maps.example.am`. The app requests foreground location permission and displays the GPS position. It contains only the map screen.

## Run the Expo app

```bash
npm install
npx expo start
```

Open it with Expo Go. For store publication, create signed Android/iOS production builds and test on physical devices.

## Important

- OpenStreetMap data is open data under the ODbL; show attribution and comply with the license.
- This is self-hosted, not magically unlimited: bandwidth, CPU, storage, server uptime and hosting costs still apply.
- The included public Geofabrik extract is an input dataset; refresh it periodically to keep map data current.
- Leaflet is loaded from its public CDN in this starter. For fully self-contained/offline app assets, bundle Leaflet locally in a later step.
