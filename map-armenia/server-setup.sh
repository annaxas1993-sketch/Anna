#!/usr/bin/env bash
set -euo pipefail
mkdir -p data
if [ ! -f data/region.osm.pbf ]; then
  curl -L --fail --output data/region.osm.pbf https://download.geofabrik.de/asia/region.osm.pbf
fi
docker compose --profile import run --rm import-armenia
docker compose up -d map-tiles
echo "Map server should answer at http://YOUR_SERVER_IP:8080"
echo "Tile URL: http://YOUR_SERVER_IP:8080/tile/{z}/{x}/{y}.png"
