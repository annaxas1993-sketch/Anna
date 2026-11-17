import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";

// After deploying the Armenia map server, replace this with its HTTPS address.
// Example: https://maps.example.am
const MAP_SERVER = "https://YOUR-ARMENIA-MAP-SERVER";

const html = `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#e8edf0}
    .leaflet-control-attribution{font-size:9px}
    .leaflet-control-zoom a{width:42px!important;height:42px!important;line-height:42px!important;font-size:24px!important}
    .me-dot{width:18px;height:18px;border-radius:50%;background:#1687ff;border:4px solid white;box-shadow:0 1px 8px #555}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const server = "${MAP_SERVER}";
  const map = L.map('map', { zoomControl:true }).setView([40.1792, 44.4991], 8);
  L.tileLayer(server + '/tile/{z}/{x}/{y}.png', {
    minZoom: 5, maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  let marker = null;
  window.setMyLocation = function(lat, lon) {
    const p = [lat, lon];
    if (!marker) marker = L.marker(p).addTo(map).bindPopup('Դուք այստեղ եք');
    else marker.setLatLng(p);
    map.setView(p, Math.max(map.getZoom(), 15));
  };
  window.centerOnMe = function() {
    if (marker) map.setView(marker.getLatLng(), 16);
  };
  window.addEventListener('message', function(e) {
    try {
      const d = JSON.parse(e.data);
      if (d.type === 'location') window.setMyLocation(d.lat, d.lon);
      if (d.type === 'center') window.centerOnMe();
    } catch (_) {}
  });
  document.addEventListener('message', function(e) {
    try {
      const d = JSON.parse(e.data);
      if (d.type === 'location') window.setMyLocation(d.lat, d.lon);
      if (d.type === 'center') window.centerOnMe();
    } catch (_) {}
  });
</script>
</body>
</html>
`;

export default function App() {
  const web = useRef(null);
  const watch = useRef(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Սպասում ենք GPS-ին");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          if (alive) setStatus("GPS թույլտվությունը անջատված է");
          return;
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) sendLocation(current.coords.latitude, current.coords.longitude);
        watch.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 8, timeInterval: 5000 },
          (position) => sendLocation(position.coords.latitude, position.coords.longitude)
        );
        if (alive) setStatus("GPS-ը միացված է");
      } catch (e) {
        if (alive) setStatus("GPS-ը հասանելի չէ");
      }
    })();
    return () => {
      alive = false;
      if (watch.current) watch.current.remove();
    };
  }, []);

  function sendLocation(lat, lon) {
    const message = JSON.stringify({ type: "location", lat, lon });
    web.current?.postMessage(message);
  }

  function center() {
    web.current?.postMessage(JSON.stringify({ type: "center" }));
  }

  const serverMissing = MAP_SERVER.includes("YOUR-ARMENIA-MAP-SERVER");

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.map}>
        <WebView
          ref={web}
          source={{ html }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          onLoadEnd={() => setLoading(false)}
          onError={() => setStatus("Քարտեզի սերվերին միանալ չհաջողվեց")}
          mixedContentMode="never"
        />
        {loading && <View style={styles.loading}><ActivityIndicator size="large" color="#1769aa" /><Text style={styles.loadingText}>Բացվում է քարտեզը…</Text></View>}
        <TouchableOpacity style={styles.locate} onPress={center} accessibilityLabel="Իմ տեղադրությունը">
          <Text style={styles.locateText}>◎</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.footer}>
        <Text style={styles.status}>{serverMissing ? "Սերվերի հասցեն դեռ պետք է տեղադրել" : status}</Text>
        <Text style={styles.country}>ՀԱՅԱՍՏԱՆԻ ՔԱՐՏԵԶ</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.88)", alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: "#263746", fontSize: 15 },
  locate: { position: "absolute", right: 16, bottom: 24, width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 5 },
  locateText: { fontSize: 32, color: "#1769aa", lineHeight: 38 },
  footer: { minHeight: 34, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff" },
  status: { fontSize: 11, color: "#687782" },
  country: { fontSize: 10, fontWeight: "700", color: "#1769aa", letterSpacing: 1 }
});
