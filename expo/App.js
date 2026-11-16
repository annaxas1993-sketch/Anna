import React, { useEffect, useRef, useState, useMemo } from "react";
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Switch, BackHandler, TextInput, ActivityIndicator, AppState, Linking, Animated, PanResponder } from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const API_BASE = "https://accepted-governmental-ppm-pre.trycloudflare.com";
const DEFAULT_LOCATION = { latitude: 40.8128, longitude: 44.4883 };
const TAXIMETER_BASE_FARE=400,TAXIMETER_INCLUDED_KM=2,TAXIMETER_EXTRA_KM_RATE=100;
function distanceBetweenMeters(a,b){const rad=v=>v*Math.PI/180,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude),x=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function calculateTaxiFare(meters){const km=Math.max(0,meters)/1000;return TAXIMETER_BASE_FARE+(km>TAXIMETER_INCLUDED_KM?Math.ceil(km-TAXIMETER_INCLUDED_KM)*TAXIMETER_EXTRA_KM_RATE:0);}
const TABS = [
  { id: "home", icon: "⌂", label: "Գլխավոր" },
  { id: "orders", icon: "▣", label: "Պատվերներ" },
  { id: "balance", icon: "₽", label: "Հաշվեկշիռ" },
  { id: "profile", icon: "●", label: "Պրոֆիլ" },
];


function CustomerCallButton({ phone }) {
  const canCall = typeof phone === "string" && phone.trim().length > 5;
  const callCustomer = async () => {
    if (!canCall) {
      Alert.alert("Հաճախորդի հեռախոս", "Զանգի կոճակը կակտիվանա, երբ սերվերը պատվերի հետ ուղարկի հաճախորդի հեռախոսահամարը։");
      return;
    }
    try {
      await Linking.openURL("tel:" + phone.replace(/[^+0-9]/g, ""));
    } catch (_) {
      Alert.alert("Զանգի սխալ", "Չհաջողվեց բացել հեռախոսազանգը։");
    }
  };
  return <TouchableOpacity disabled={!canCall} onPress={callCustomer} style={[styles.customerCallButton, !canCall && styles.customerCallButtonDisabled]}><Text style={styles.customerCallButtonText}>☎  ԶԱՆԳԵԼ ՀԱՃԱԽՈՐԴԻՆ</Text></TouchableOpacity>;
}

function Metric({ value, label }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function Row({ title, detail, icon = "›", onPress }) {
  return <TouchableOpacity style={styles.row} onPress={onPress || (() => Alert.alert(title, "Այս բաժինը կմիանա սերվերին հաջորդ փուլում։"))}><View style={styles.rowIcon}><Text style={styles.rowIconText}>{icon}</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text>{detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}</View><Text style={styles.chevron}>›</Text></TouchableOpacity>;
}

export default function App() {
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState("home");
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [gpsReady, setGpsReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [fareDistanceMeters,setFareDistanceMeters]=useState(0);
  const [fareTripOrderId,setFareTripOrderId]=useState(null);
  const fareDistanceRef=useRef(0),fareLastPositionRef=useRef(null),activeTripRef=useRef(null);
  const [profileSection, setProfileSection] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMapEnabled, setDarkMapEnabled] = useState(false);
  const [mapStyle, setMapStyle] = useState("light");
  const [priorityEnabled, setPriorityEnabled] = useState(false);
  const [driverRating, setDriverRating] = useState(5.0);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [driverRegName,setDriverRegName]=useState("");
  const [driverRegPhone,setDriverRegPhone]=useState("");
  const [driverRegPassword,setDriverRegPassword]=useState("");
  const [driverRegCar,setDriverRegCar]=useState("");
  const [driverRegPlate,setDriverRegPlate]=useState("");
  const [driverRegLicense,setDriverRegLicense]=useState("");
  const [driverRegMessage,setDriverRegMessage]=useState("");
  const [driverRegBusy,setDriverRegBusy]=useState(false);
  const [authToken,setAuthToken]=useState(null);
  const [authUser,setAuthUser]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const [authPhone,setAuthPhone]=useState("");
  const [authPassword,setAuthPassword]=useState("");
  const [authBusy,setAuthBusy]=useState(false);
  const [driverBalance,setDriverBalance]=useState(0);
  const [balanceTransactions,setBalanceTransactions]=useState([]);
  const [vehicleCheck,setVehicleCheck]=useState({brakes:true,tires:true,lights:true,signals:true,mirrors:true,seatbelts:true,documents:true});
  const [vehicleCheckNote,setVehicleCheckNote]=useState("");
  const [vehicleCheckHistory,setVehicleCheckHistory]=useState([]);
  const [vehicleCheckDue,setVehicleCheckDue]=useState(true);
  const [vehicleCheckDueAt,setVehicleCheckDueAt]=useState(null);
  const [vehicleCheckBusy,setVehicleCheckBusy]=useState(false);
  const [balanceLoading,setBalanceLoading]=useState(false);
  const [availableOrders,setAvailableOrders]=useState([]);
  const [myOrders,setMyOrders]=useState([]);
  const mapRef = useRef(null);
  const [sheetExpanded,setSheetExpanded]=useState(true);
  const sheetAnim=useRef(new Animated.Value(1)).current;
  const sheetPan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dy)>5,
    onPanResponderRelease:(_,g)=>{
      if(g.dy < -35){setSheetExpanded(true);Animated.spring(sheetAnim,{toValue:1,useNativeDriver:false,bounciness:3}).start();}
      else if(g.dy > 35){setSheetExpanded(false);Animated.spring(sheetAnim,{toValue:0,useNativeDriver:false,bounciness:3}).start();}
    }
  })).current;
  const destination = { latitude: location.latitude + 0.0065, longitude: location.longitude + 0.0075 };
  const apiRequest = async (path, options = {}) => {
    const response = await fetch(API_BASE + path, { ...options, headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: "Bearer " + authToken } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Սերվերի հետ կապը չհաջողվեց");
    return data;
  };
  const zoomMap = (factor) => mapRef.current?.injectJavaScript(`window.axasZoom && window.axasZoom(${factor}); true;`);
  const searchAddress = async () => {
    const query = addressQuery.trim();
    if (!query) { Alert.alert("Հասցեի որոնում", "Գրիր փողոցը, շենքը կամ հասցեն։"); return; }
    setAddressLoading(true); setAddressResults([]);
    try {
      const response = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&countrycodes=am&viewbox=44.40,40.87,44.58,40.75&bounded=0&accept-language=hy,en&q=" + encodeURIComponent(query + (/[վՎ]անաձոր|vanadzor/i.test(query) ? "" : ", Vanadzor, Armenia")));
      if (!response.ok) throw new Error("search");
      const results = await response.json();
      setAddressResults(results.map(item => ({ id: item.place_id, name: item.display_name, lat: Number(item.lat), lon: Number(item.lon) })));
      if (!results.length) Alert.alert("Հասցեն չի գտնվել", "Փորձիր գրել հասցեն ավելի մանրամասն։");
    } catch (e) { Alert.alert("Որոնման սխալ", "Հասցեն չհաջողվեց գտնել։ Ստուգիր ինտերնետը։"); }
    finally { setAddressLoading(false); }
  };
  const navigateToAddress = (item) => {
    setAddressQuery(item.name);
    setAddressResults([]);
    mapRef.current?.injectJavaScript("window.axasNavigateToAddress && window.axasNavigateToAddress("+item.lat+","+item.lon+","+JSON.stringify(item.name)+"); true;");
  };
  const mapHtml = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;width:100%;margin:0;background:#f2f2f0} .leaflet-tile{filter:${darkMapEnabled ? 'brightness(.62) invert(.88) hue-rotate(180deg) saturate(.72) contrast(.92)' : 'none'};}.leaflet-control-attribution{background:#ffffffdd!important;color:#667085!important;font-size:9px!important}.leaflet-control-attribution a{color:#333!important}.leaflet-control-zoom a{background:#ffffff!important;color:#111!important;border-color:#dddddd!important}.driver-dot{width:0;height:0;border-left:16px solid transparent;border-right:16px solid transparent;border-bottom:44px solid #555555;filter:drop-shadow(0 3px 7px #0004);position:relative;transform-origin:50% 50%}.driver-dot:after{content:'';position:absolute;left:-8px;top:13px;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:22px solid #ffffff}.driver-pulse{position:absolute;width:58px;height:58px;border-radius:50%;background:#20d6a033;border:1px solid #20d6a088;left:-13px;top:-7px;z-index:-1}.route-card{display:none;position:absolute;top:82px;left:12px;right:12px;z-index:500;background:#ffffffed;color:#111;padding:11px 13px;border-radius:15px;border:1px solid #e5e5e5;font:12px Arial;box-shadow:0 4px 14px #0006}.route-card b{color:#c5a900}.route-sub{color:#777777;font-size:10px;margin-top:4px}.map-search{position:absolute;top:auto;bottom:108px;left:auto;right:12px;width:50px;height:50px;z-index:1200;display:flex;align-items:center;justify-content:center;gap:0;padding:4px;background:#ffffff;border:1px solid #e5e5e5;border-radius:50%;box-shadow:0 4px 16px #0008;transition:all .2s}.map-search.open{left:12px;right:12px;width:auto;height:50px;justify-content:space-between;gap:6px;padding:5px;border-radius:14px}.map-search input{display:none;min-width:0;flex:1;border:0;outline:0;background:transparent;color:#fff;font-size:14px;padding:8px}.map-search.open input{display:block}.map-search input::placeholder{color:#8492a8}.map-search button{width:40px;height:40px;flex:none;border:0;border-radius:50%;background:#ffe000;color:#111111;font-size:25px;line-height:40px;text-align:center;font-weight:bold;padding:0}.map-search.open button{border-radius:10px;font-size:20px}.map-search-results{display:none;position:absolute;top:auto;bottom:166px;left:12px;right:12px;z-index:1201;background:#101b2bf5;border:1px solid #40536b;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px #0009}.map-search-results button{display:block;width:100%;padding:12px;text-align:left;background:transparent;color:#fff;border:0;border-bottom:1px solid #26364b;font-size:12px}.map-leave{display:none;position:absolute;z-index:1200;bottom:24px;left:50%;transform:translateX(-50%);padding:14px 22px;border:1px solid #fff;border-radius:28px;background:#20d6a0;color:#06251b;font:bold 13px Arial;letter-spacing:.4px;box-shadow:0 4px 16px #0009;white-space:nowrap}.leave-confirm{display:none;position:absolute;inset:0;z-index:2500;background:#000b;align-items:flex-end;justify-content:center;padding:18px 12px}.leave-confirm-card{width:100%;background:#171923;border:1px solid #303449;border-radius:28px;padding:24px 18px 22px;box-shadow:0 8px 28px #0009}.leave-confirm-title{font:bold 20px Arial;color:#f4f6ff;margin-bottom:8px}.leave-confirm-sub{font:14px Arial;color:#969caf;margin-bottom:22px}.leave-confirm-red,.leave-confirm-cancel{display:block;width:100%;padding:16px;border-radius:18px;font:bold 16px Arial;margin-top:10px}.leave-confirm-red{background:#ff4b55;color:#fff;border:0}.leave-confirm-cancel{background:#252938;color:#a4a9bb;border:1px solid #34394b}</style></head><body><div id="map"></div><div class="map-search"><input id="mapSearchInput" type="search" placeholder="Որոնել հասցե կամ փողոց..."><button id="mapSearchButton" aria-label="Որոնել">⌕</button></div><div class="map-search-results" id="mapSearchResults"></div><div class="route-card" id="routeCard"></div><button id="leaveRoute" class="map-leave" onclick="window.axasShowLeaveConfirm()">↗ &nbsp; ԴՈՒՐՍ ԳԱԼ ԵՐԹՈՒՂՈՒՑ</button><div id="leaveConfirm" class="leave-confirm"><div class="leave-confirm-card"><div class="leave-confirm-title">Լքե՞լ երթուղագիծը</div><div class="leave-confirm-sub">Դուրս գալու դեպքում ընթացիկ երթուղին կավարտվի։</div><button class="leave-confirm-red" onclick="window.axasLeaveRoute()">ԼՔԵԼ ԵՐԹՈՒՂԻՆ</button><button class="leave-confirm-cancel" onclick="window.axasHideLeaveConfirm()">ՉԵՂԱՐԿԵԼ</button></div></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:false}).setView([${location.latitude},${location.longitude}],15);let tiles;window.axasMapStyle=function(mode){if(tiles)map.removeLayer(tiles);const url=mode==='satellite'?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://tile.openstreetmap.org/{z}/{x}/{y}.png';const attribution=mode==='satellite'?'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics':'© OpenStreetMap contributors';tiles=L.tileLayer(url,{maxZoom:19,attribution:attribution,crossOrigin:true});tiles.addTo(map);};window.axasMapStyle('light');const icon=L.divIcon({className:'',html:'<div class="driver-pulse"></div><div class="driver-dot"></div>',iconSize:[44,50],iconAnchor:[22,25]});const marker=L.marker([${location.latitude},${location.longitude}],{icon}).addTo(map);window.axasZoom=function(f){map.setZoom(Math.max(3,Math.min(20,map.getZoom()+(f<1?1:-1))))};window.axasLocate=function(){window.axasFollow=true;map.setView(marker.getLatLng(),17,{animate:true})};let addressTarget=null,lastAddressReroute=0;window.axasSetPosition=function(lat,lng,heading){marker.setLatLng([lat,lng]);checkVoiceGuidance(L.latLng(lat,lng));const arrow=marker.getElement()?.querySelector('.driver-dot');if(arrow&&Number.isFinite(heading))arrow.style.transform='rotate('+heading+'deg)';if(window.axasFollow)map.panTo([lat,lng],{animate:true,duration:.7});if(addressTarget){const now=Date.now(),moved=map.distance(marker.getLatLng(),addressTarget);if(moved>60&&now-lastAddressReroute>15000){lastAddressReroute=now;drawRoute(marker.getLatLng(),addressTarget,'ԸՆՏՐՎԱԾ ՀԱՍՑԵԻ ԵՐԹՈՒՂԻ')}}};window.axasFollow=true;window.axasToggleFollow=function(){window.axasFollow=!window.axasFollow;return window.axasFollow};map.on("dragstart",function(){window.axasFollow=false});window.axasResumeFollow=function(){window.axasFollow=true;map.setView(marker.getLatLng(),17,{animate:true})};let routeLine=null,routeGlow=null,pickupPoint=null,destinationPoint=null,passengerOnboard=false,pickupMarker=null,destinationMarker=null,routeRequestId=0;
let voiceEnabled=true,voiceManeuvers=[],voiceIndex=0;
function speakArmenian(message){if(!voiceEnabled||!('speechSynthesis' in window))return;try{window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(message);utterance.lang='hy-AM';utterance.rate=0.92;utterance.pitch=1;window.speechSynthesis.speak(utterance)}catch(e){}}
function toggleVoiceGuidance(){voiceEnabled=!voiceEnabled;if(!voiceEnabled&&'speechSynthesis' in window)window.speechSynthesis.cancel();else if(voiceManeuvers.length){const next=voiceManeuvers[voiceIndex];speakArmenian(next?'Ձայնային ուղղորդումը միացված է։ Հաջորդը՝ '+next.text:'Ձայնային ուղղորդումը միացված է։')}const button=document.getElementById('voiceToggle');if(button)button.textContent=voiceEnabled?'🔊 ՁԱՅՆԸ ՄԻԱՑՐԱԾ':'🔇 ՁԱՅՆԸ ԱՆՋԱՏՎԱԾ';}
function maneuverText(step){const m=step.maneuver||{},mod=m.modifier||'',type=m.type||'';let action='Շարունակեք ուղիղ';if(mod.includes('left'))action='Թեքվեք ձախ';else if(mod.includes('right'))action='Թեքվեք աջ';else if(mod==='uturn')action='Կատարեք հետադարձ';else if(type==='roundabout'||type==='rotary')action='Մտեք շրջանաձև երթևեկություն';else if(type==='arrive')action='Դուք հասել եք նպատակակետին';const street=step.name?' դեպի '+step.name:'';return action+street;}
function checkVoiceGuidance(latlng){if(!voiceEnabled||voiceIndex>=voiceManeuvers.length)return;const next=voiceManeuvers[voiceIndex],meters=map.distance(latlng,next.location);if(meters<=220){speakArmenian(meters>65?'Մոտ '+Math.round(meters/50)*50+' մետրից։ '+next.text:next.text);voiceIndex++;}}
async function drawRoute(from,to,label){const requestId=++routeRequestId;const card=document.getElementById('routeCard');card.style.display='block';card.innerHTML='<b>'+label+'</b><div class="route-sub">Երթուղին հաշվարկվում է...</div>';try{const url='https://router.project-osrm.org/route/v1/driving/'+from.lng+','+from.lat+';'+to.lng+','+to.lat+'?overview=full&geometries=geojson&steps=true';const response=await fetch(url);if(!response.ok)throw new Error('route');const data=await response.json();if(requestId!==routeRequestId)return;if(!data.routes||!data.routes.length)throw new Error('route');const route=data.routes[0],coords=route.geometry.coordinates.map(p=>[p[1],p[0]]);voiceManeuvers=(route.legs||[]).flatMap(leg=>(leg.steps||[]).filter(step=>step.maneuver&&step.maneuver.type!=='depart').map(step=>({location:L.latLng(step.maneuver.location[1],step.maneuver.location[0]),text:maneuverText(step)})));voiceIndex=0;if(voiceManeuvers.length)speakArmenian('Երթուղին սկսվում է։ '+voiceManeuvers[0].text);if(routeGlow)map.removeLayer(routeGlow);if(routeLine)map.removeLayer(routeLine);routeGlow=L.polyline(coords,{color:'#ffffff',weight:10,opacity:.55,lineCap:'round'}).addTo(map);routeLine=L.polyline(coords,{color:'#f4c400',weight:7,opacity:.98,lineCap:'round'}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[55,55]});card.innerHTML='<b>'+label+'</b><div class="route-sub">Հեռավորություն՝ '+(route.distance/1000).toFixed(1)+' կմ • Մոտավոր՝ '+Math.round(route.duration/60)+' րոպե</div><button id="voiceToggle" onclick="window.axasToggleVoice()" style="margin-top:8px;margin-right:6px;padding:8px 10px;border:1px solid #20d6a0;border-radius:8px;background:#102b28;color:#20d6a0;font-weight:bold">🔊 ՁԱՅՆԸ ՄԻԱՑՐԱԾ</button>'+(label==='ՈւՂԵՎՈՐԻՆ ՀԱՍՑՆԵԼՈՒ ԵՐԹՈՒՂԻ'?'':'<button onclick="window.axasPassengerPickedUp()" style="margin-top:8px;padding:8px 12px;border:0;border-radius:8px;background:#20d6a0;color:#061810;font-weight:bold">ՈՒՂԵՎՈՐԻՆ ՎԵՐՑՐԻ</button>');}catch(err){if(requestId!==routeRequestId)return;card.innerHTML='<b>ՀԱՍՑԵՆ ՆՇՎԱԾ Է ՔԱՐՏԵԶԻ ՎՐԱ</b><div class="route-sub">Գտնվելու վայրը նշված է կանաչ քարտեզի նշիչով, բայց մեքենայի երթուղին չհաշվարկվեց։ Փորձիր կրկին՝ ինտերնետը ստուգելուց հետո։</div>';if(addressTarget){map.setView(addressTarget,17,{animate:true});if(destinationMarker)destinationMarker.openPopup();}}}
map.on('click',function(e){if(!pickupPoint){pickupPoint=e.latlng;pickupMarker=L.marker(e.latlng).addTo(map).bindPopup('Ուղևորի վերցնելու կետ').openPopup();document.getElementById('leaveRoute').style.display='block';const a=marker.getLatLng();drawRoute(a,pickupPoint,'ՈՒՂԵՎՈՐԻ ՎԵՐՑՆԵԼՈՒ ԵՐԹՈՒՂԻ');return;}if(!destinationPoint){destinationPoint=e.latlng;destinationMarker=L.marker(e.latlng).addTo(map).bindPopup('Ուղևորի վերջնակետ');document.getElementById('routeCard').innerHTML='<b>ՎԵՐՑՆԵԼՈՒ ԿԵՏԸ ԵՎ ՎԵՐՋՆԱԿԵՏԸ ՆՇՎԱԾ ԵՆ</b><div class="route-sub">Սեղմիր «Ուղևորին վերցրի»՝ A կետից B կետ երթուղին սկսելու համար։</div><button onclick="window.axasPassengerPickedUp()" style="margin-top:8px;padding:8px 12px;border:0;border-radius:8px;background:#20d6a0;color:#061810;font-weight:bold">ՈՒՂԵՎՈՐԻՆ ՎԵՐՑՐԻ</button>';return;}window.axasLeaveRoute();});
window.axasToggleVoice=toggleVoiceGuidance;window.axasPassengerPickedUp=function(){if(!pickupPoint||!destinationPoint)return;passengerOnboard=true;drawRoute(pickupPoint,destinationPoint,'ՈՒՂԵՎՈՐԻՆ ՀԱՍՑՆԵԼՈՒ ԵՐԹՈՒՂԻ');};window.axasNavigateToAddress=function(lat,lng,name){window.axasLeaveRoute();addressTarget=L.latLng(lat,lng);destinationMarker=L.marker(addressTarget).addTo(map).bindPopup('<b>Գտնված հասցե</b><br>'+name).openPopup();document.getElementById('leaveRoute').style.display='block';window.axasFollow=false;lastAddressReroute=Date.now();map.setView(addressTarget,17,{animate:true});setTimeout(()=>{if(destinationMarker)destinationMarker.openPopup()},350);drawRoute(marker.getLatLng(),addressTarget,'ԸՆՏՐՎԱԾ ՀԱՍՑԵԻ ԵՐԹՈՒՂԻ')};const mapSearchInput=document.getElementById('mapSearchInput'),mapSearchResults=document.getElementById('mapSearchResults');let searchTimer=null,searchRequest=0;async function loadAddressSuggestions(q){const request=++searchRequest;mapSearchResults.style.display='block';mapSearchResults.innerHTML='<button>Հասցեները որոնվում են...</button>';try{const preferred=/[վՎ]անաձոր|vanadzor/i.test(q)?q:q+', Vanadzor, Armenia';let r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&countrycodes=am&viewbox=44.40,40.87,44.58,40.75&bounded=0&accept-language=hy,en&q='+encodeURIComponent(preferred));if(!r.ok)throw new Error('search');let items=await r.json();if(request!==searchRequest)return;if(!items.length&&preferred!==q){r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&countrycodes=am&accept-language=hy,en&q='+encodeURIComponent(q));if(!r.ok)throw new Error('search');items=await r.json()}items.sort((a,b)=>{const city=x=>String(x.address?.city||x.address?.town||x.address?.municipality||'').toLowerCase().includes('vanadzor')?1:0;return city(b)-city(a)});if(!items.length){mapSearchResults.innerHTML='<button>Հասցեն չի գտնվել․ փորձիր ավելի մանրամասն գրել</button>';return}mapSearchResults.innerHTML='';items.forEach(item=>{const b=document.createElement('button');b.textContent=item.display_name;b.onclick=()=>{searchRequest++;mapSearchResults.style.display='none';document.querySelector('.map-search').classList.remove('open');mapSearchInput.value=item.display_name;window.axasNavigateToAddress(Number(item.lat),Number(item.lon),item.display_name)};mapSearchResults.appendChild(b)})}catch(e){if(request===searchRequest)mapSearchResults.innerHTML='<button>Որոնման սխալ․ ստուգիր ինտերնետը</button>'}}mapSearchInput.addEventListener('input',()=>{clearTimeout(searchTimer);const q=mapSearchInput.value.trim();if(q.length<3){searchRequest++;mapSearchResults.style.display='none';mapSearchResults.innerHTML='';return}searchTimer=setTimeout(()=>loadAddressSuggestions(q),450)});document.getElementById('mapSearchButton').onclick=window.axasSearchAddress=function(){const wrap=document.querySelector('.map-search');if(wrap.classList.contains('open')){wrap.classList.remove('open');mapSearchResults.style.display='none';mapSearchResults.innerHTML='';mapSearchInput.blur();return}wrap.classList.add('open');setTimeout(()=>mapSearchInput.focus(),80)};mapSearchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=mapSearchResults.querySelector('button');if(mapSearchResults.style.display!=='none'&&first&&first.textContent!=='Հասցեները որոնվում են...')first.click();else window.axasSearchAddress()}});window.axasShowLeaveConfirm=function(){document.getElementById("leaveConfirm").style.display="flex"};window.axasHideLeaveConfirm=function(){document.getElementById("leaveConfirm").style.display="none"};window.axasLeaveRoute=function(){window.axasHideLeaveConfirm();routeRequestId++;if('speechSynthesis' in window)window.speechSynthesis.cancel();voiceManeuvers=[];voiceIndex=0;addressTarget=null;pickupPoint=null;destinationPoint=null;passengerOnboard=false;if(routeLine)map.removeLayer(routeLine);if(routeGlow)map.removeLayer(routeGlow);if(pickupMarker)map.removeLayer(pickupMarker);if(destinationMarker)map.removeLayer(destinationMarker);routeLine=null;routeGlow=null;pickupMarker=null;destinationMarker=null;document.getElementById('routeCard').innerHTML='';document.getElementById('routeCard').style.display='none';document.getElementById('leaveRoute').style.display='none';window.axasFollow=true;map.setView(marker.getLatLng(),16,{animate:true});};
setTimeout(()=>{map.invalidateSize();if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('MAP_READY')},700);</script></body></html>`, []);

  // Check GitHub Releases for a newer APK whenever the driver opens/resumes the app.
  useEffect(() => {
    let active = true;
    let alerted = false;
    let lastCheck = 0;
    const installedBuild = Number(Constants.nativeBuildVersion || Constants.expoConfig?.android?.versionCode || 1);
    const checkForUpdate = async () => {
      if (!active || alerted || Date.now() - lastCheck < 60000) return;
      lastCheck = Date.now();
      try {
        const response = await fetch("https://api.github.com/repos/annaxas1993-sketch/Anna/releases/latest", {
          headers: { Accept: "application/vnd.github+json" }
        });
        if (!response.ok) return;
        const release = await response.json();
        const match = String(release.tag_name || "").match(/^taxi-lider-build-(\d+)$/);
        const latestBuild = match ? Number(match[1]) : 0;
        const apk = (release.assets || []).find(asset => asset.name === "app-release.apk");
        if (!active || !apk || latestBuild <= installedBuild) return;
        alerted = true;
        Alert.alert(
          "TAXI LIDER-ի նոր տարբերակ կա",
          "Հասանելի է նոր տարբերակ։ APK-ն կներբեռնվի, հետո բացիր ներբեռնված ֆայլը և հաստատիր տեղադրումը։",
          [
            { text: "Ավելի ուշ", style: "cancel", onPress: () => { alerted = false; } },
            { text: "Ներբեռնել", onPress: () => Linking.openURL(apk.browser_download_url).catch(() => Alert.alert("Սխալ", "Չհաջողվեց բացել APK-ի ներբեռնումը։")) }
          ],
          { cancelable: true, onDismiss: () => { alerted = false; } }
        );
      } catch (_) {
        // Update checks are optional; never block driver sign-in or order handling.
      }
    };
    checkForUpdate();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") checkForUpdate();
    });
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    let active = true;
    let subscription;
    const applyPosition = (position) => {
      if (!active || !position?.coords) return;
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const activeTrip=activeTripRef.current,accuracy=Number(position.coords.accuracy);
      if(activeTrip&&Number.isFinite(accuracy)&&accuracy<=35){
        const previous=fareLastPositionRef.current;
        if(previous){const segment=distanceBetweenMeters(previous,point);if(segment>=3&&segment<=120){fareDistanceRef.current+=segment;setFareDistanceMeters(fareDistanceRef.current);}}
        fareLastPositionRef.current=point;
      }
      setLocation(point);
      setGpsReady(true);
      setSpeedKmh(Math.max(0, Math.round((position.coords.speed || 0) * 3.6)));
    };
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (permission.status !== "granted") {
        Alert.alert("GPS-ի թույլտվություն", "Միացրու AXAS Driver-ի տեղադրության թույլտվությունը, որպեսզի քարտեզը ցույց տա վարորդի իրական դիրքը։");
        return;
      }
      // Show the last known GPS fix immediately while a fresh fix is acquired.
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 1500 });
        if (last) applyPosition(last);
      } catch (_) {}
      // Start continuous GPS updates before requesting a fresh one.
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
        applyPosition
      );
      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true
        });
        applyPosition(current);
      } catch (_) {
        // The watcher can still deliver the first accurate GPS position.
      }
    })().catch(() => {
      if (active) Alert.alert("GPS-ի սխալ", "Չհաջողվեց ստանալ տեղադրությունը։ Միացրու հեռախոսի GPS-ը և փորձիր կրկին։");
    });
    return () => { active = false; subscription?.remove(); };
  }, []);

  useEffect(()=>{
    const trip=(myOrders||[]).find(order=>order.status==="started");
    if(!trip){activeTripRef.current=null;fareLastPositionRef.current=null;setFareTripOrderId(null);return;}
    if(activeTripRef.current?.id!==trip.id){activeTripRef.current=trip;fareDistanceRef.current=0;fareLastPositionRef.current=null;setFareDistanceMeters(0);setFareTripOrderId(trip.id);}
  },[myOrders]);

  // Restore the authenticated driver session after app restart.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("taxi_lider_driver_token");
        if (!saved) return;
        const response = await fetch(API_BASE + "/api/me", { headers: { Authorization: "Bearer " + saved } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.user?.role !== "driver") { await AsyncStorage.removeItem("taxi_lider_driver_token"); return; }
        try { await fetch(API_BASE + "/api/drivers/availability", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + saved }, body: JSON.stringify({ online: false }) }); } catch (_) {}
        if (active) { setAuthToken(saved); setAuthUser(data.user); setOnline(false); }
      } catch (_) {}
      finally { if (active) setAuthReady(true); }
    })();
    return () => { active = false; };
  }, []);

  // Publish GPS only for an approved driver who has switched to online.
  useEffect(() => {
    if (!authToken || authUser?.role !== "driver" || authUser?.approval_status !== "approved" || !online || !gpsReady) return;
    fetch(API_BASE + "/api/drivers/location", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken }, body: JSON.stringify({ lat: location.latitude, lng: location.longitude }) }).catch(() => {});
  }, [authToken, authUser, online, gpsReady, location.latitude, location.longitude]);

  // Load the authenticated driver wallet and its server-side top-up history.
  useEffect(() => {
    if (!authToken || authUser?.role !== "driver") { setDriverBalance(0); setBalanceTransactions([]); return; }
    let active = true;
    setBalanceLoading(true);
    fetch(API_BASE + "/api/drivers/balance", { headers: { Authorization: "Bearer " + authToken } })
      .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Հաշվեկշիռը չբեռնվեց"); return data; })
      .then(data => { if (active) { setDriverBalance(Number(data.balance || 0)); setBalanceTransactions(data.transactions || []); } })
      .catch(() => {})
      .finally(() => { if (active) setBalanceLoading(false); });
    return () => { active = false; };
  }, [authToken, authUser?.role]);

  // Refresh available and assigned orders while an approved driver is online.
  useEffect(() => {
    if (!authToken || authUser?.role !== "driver") return;
    let active = true;
    const loadOrders = async () => {
      try {
        const [available, mine, profile] = await Promise.all([
          fetch(API_BASE + "/api/orders/available", { headers: { Authorization: "Bearer " + authToken } }),
          fetch(API_BASE + "/api/orders/mine", { headers: { Authorization: "Bearer " + authToken } }),
          fetch(API_BASE + "/api/me", { headers: { Authorization: "Bearer " + authToken } })
        ]);
        const [a, m, p] = await Promise.all([available.json(), mine.json(), profile.json()]);
        if (active) {
          if (available.ok) setAvailableOrders(a.orders || []);
          if (mine.ok) setMyOrders(m.orders || []);
          if (profile.ok) setAuthUser(current => current ? { ...current, ...p.user } : current);
        }
      } catch (_) {}
    };
    loadOrders();
    const timer = setInterval(loadOrders, 8000);
    return () => { active = false; clearInterval(timer); };
  }, [authToken, authUser]);

  // Refresh GPS whenever the driver returns to the app from background.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true
        });
        if (!current?.coords) return;
        const point = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setLocation(point);
        setGpsReady(true);
        setSpeedKmh(Math.max(0, Math.round((current.coords.speed || 0) * 3.6)));
      } catch (_) {}
    });
    return () => subscription.remove();
  }, []);

  // Wait until Leaflet and its marker are initialized before sending the newest GPS fix.
  useEffect(() => {
    if (!mapReady || !gpsReady) return;
    mapRef.current?.injectJavaScript(
      `if(window.axasSetPosition){window.axasSetPosition(${location.latitude},${location.longitude},0);window.axasLocate();} true;`
    );
  }, [mapReady, gpsReady, location.latitude, location.longitude]);

  const toggleOnline = async () => {
    if (!authToken || !authUser) { setTab("profile"); setProfileSection("login"); Alert.alert("Մուտք գործիր", "Առցանց դառնալու համար նախ մուտք գործիր վարորդի հաշվով։"); return; }
    if (authUser.approval_status !== "approved") { Alert.alert("Հաշիվը հաստատված չէ", authUser.approval_status === "rejected" ? "Գրանցումը մերժվել է։ Կապվիր դիսպետչերի հետ։" : "Դիսպետչերը դեռ պետք է հաստատի քո վարորդի հաշիվը։"); return; }
    try {
      const next = !online;
      await apiRequest("/api/drivers/availability", { method: "PATCH", body: JSON.stringify({ online: next }) });
      setOnline(next);
      if (next && !gpsReady) Alert.alert("GPS", "Միացրու հեռախոսի տեղադրությունը, որպեսզի դիսպետչերը տեսնի մեքենայի դիրքը։");
    } catch (e) { Alert.alert("Կապի սխալ", e.message); }
  };

  const loginDriver = async () => {
    if (!authPhone.trim() || !authPassword) { Alert.alert("Մուտք", "Լրացրու հեռախոսահամարը և գաղտնաբառը։"); return; }
    setAuthBusy(true);
    try {
      const data = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ phone: authPhone.trim(), password: authPassword }) });
      if (data.user?.role !== "driver") throw new Error("Այս հաշիվը վարորդի հաշիվ չէ։ Գրանցվիր որպես վարորդ։");
      await AsyncStorage.setItem("taxi_lider_driver_token", data.token);
      setAuthToken(data.token); setAuthUser(data.user); setAuthPassword(""); setOnline(false); setProfileSection("");
      Alert.alert("Մուտքը հաջող է", data.user.approval_status === "approved" ? "Քո վարորդի հաշիվը հաստատված է։ Կարող ես անցնել առցանց։" : "Հաշիվը սպասում է դիսպետչերի հաստատմանը։");
    } catch (e) { Alert.alert("Մուտքի սխալ", e.message); }
    finally { setAuthBusy(false); }
  };

  const logoutDriver = async () => {
    try { if (authToken && online) await apiRequest("/api/drivers/availability", { method: "PATCH", body: JSON.stringify({ online: false }) }); } catch (_) {}
    await AsyncStorage.removeItem("taxi_lider_driver_token");
    setAuthToken(null); setAuthUser(null); setOnline(false); setAvailableOrders([]); setMyOrders([]); setProfileSection("");
  };

  const rejectOrder = async (id) => {
    try {
      const data = await apiRequest("/api/orders/" + id + "/reject", { method: "POST" });
      setAvailableOrders(list => list.filter(o => o.id !== id));
      if (data.driver) setAuthUser(current => current ? { ...current, ...data.driver } : current);
      Alert.alert("Պատվերը մերժված է", "Ընթացիկ վարկանիշ՝ " + Number(data.driver?.driver_rating ?? authUser?.driver_rating ?? 5).toFixed(1));
    } catch (e) { Alert.alert("Մերժման սխալ", e.message); }
  };

  const acceptOrder = async (id) => {
    try { await apiRequest("/api/orders/" + id + "/accept", { method: "POST" }); const data = await apiRequest("/api/orders/mine"); setMyOrders(data.orders || []); setAvailableOrders(list => list.filter(o => o.id !== id)); Alert.alert("Պատվերն ընդունված է", "Պատվերը ավելացվել է քո ընթացիկ ուղևորություններին։"); }
    catch (e) { Alert.alert("Պատվերի սխալ", e.message); }
  };

  const updateOrderStatus = async (id, status) => {
    try {
      if(status==="started"){fareDistanceRef.current=0;fareLastPositionRef.current=null;setFareDistanceMeters(0);setFareTripOrderId(id);activeTripRef.current={id,status};}
      const statusResult = await apiRequest("/api/orders/"+id+"/status",{method:"POST",body:JSON.stringify({status})});
      if (statusResult.driver) setAuthUser(current => current ? { ...current, ...statusResult.driver } : current);
      const data=await apiRequest("/api/orders/mine");setMyOrders(data.orders||[]);
      if(status==="completed"){const meters=fareDistanceRef.current;Alert.alert("Ուղևորությունն ավարտված է","Անցած ճանապարհ՝ "+(meters/1000).toFixed(2)+" կմ\\nՈւղեվարձ՝ "+calculateTaxiFare(meters).toLocaleString("hy-AM")+" ֏");activeTripRef.current=null;fareLastPositionRef.current=null;setFareTripOrderId(null);}
    }catch(e){Alert.alert("Պատվերի սխալ",e.message);}
  };

  const renderOrders = () => (
    <>
      <Text style={styles.pageTitle}>Պատվերներ</Text>
      <Text style={styles.pageSubtitle}>Նոր առաջարկներ և ընթացիկ ուղևորություններ</Text>
      {!authUser ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Մուտք գործիր վարորդի հաշվով</Text>
          <TouchableOpacity style={styles.outlineButton} onPress={() => { setTab("profile"); setProfileSection("login"); }}>
            <Text style={styles.outlineButtonText}>ՄՈՒՏՔ ԳՈՐԾԵԼ</Text>
          </TouchableOpacity>
        </View>
      ) : authUser.approval_status !== "approved" ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Սպասում է հաստատման</Text>
          <Text style={styles.infoText}>Դիսպետչերը պետք է հաստատի քո հաշիվը, մինչև պատվերներ ստանալը։</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>ՆՈՐ ՊԱՏՎԵՐՆԵՐ ({availableOrders.length})</Text>
          {availableOrders.map(o => (
            <View key={o.id} style={[styles.infoCard, { marginTop: 10 }]}>
              <Text style={styles.infoTitle}>Վերցնել՝ {o.pickup_address}</Text>
              <Text style={styles.infoText}>Ուղղություն՝ {o.destination_address}</Text>
              <Text style={styles.infoText}>Ուղևոր՝ {o.passenger_name || "Հաճախորդ"}</Text>
              <TouchableOpacity onPress={() => acceptOrder(o.id)} style={[styles.outlineButton, { backgroundColor: "#20D6A0" }]}>
                <Text style={[styles.outlineButtonText, { color: "#06251B" }]}>ԸՆԴՈՒՆԵԼ ՊԱՏՎԵՐԸ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => rejectOrder(o.id)} style={[styles.outlineButton, { borderColor: "#D85A62", marginTop: 8 }]}>
                <Text style={[styles.outlineButtonText, { color: "#FF9298" }]}>ՄԵՐԺԵԼ ՊԱՏՎԵՐԸ</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>ԻՄ ԸՆԹԱՑԻԿ ՊԱՏՎԵՐՆԵՐԸ</Text>
          {myOrders.filter(o => ["accepted", "arrived", "started"].includes(o.status)).map(o => (
            <View key={o.id} style={[styles.infoCard, { marginTop: 10 }]}>
              <Text style={styles.infoTitle}>Ուղղություն՝ {o.destination_address}</Text>
              <Text style={styles.infoText}>Վերցնել՝ {o.pickup_address}</Text>
              <Text style={styles.infoText}>Ուղևոր՝ {o.passenger_name || "Հաճախորդ"} · {o.passenger_phone || ""}</Text>
              <CustomerCallButton phone={o.passenger_phone} />
              {o.status === "accepted" ? <TouchableOpacity style={styles.outlineButton} onPress={() => updateOrderStatus(o.id, "arrived")}><Text style={styles.outlineButtonText}>ԺԱՄԱՆԵԼ ԵՄ</Text></TouchableOpacity> : null}
              {o.status === "arrived" ? <TouchableOpacity style={styles.outlineButton} onPress={() => updateOrderStatus(o.id, "started")}><Text style={styles.outlineButtonText}>ՍԿՍԵԼ ՈՒՂԵՎՈՐՈՒԹՅՈՒՆԸ</Text></TouchableOpacity> : null}
              {o.status === "started" ? <><View style={styles.taximeterCard}><Text style={styles.taximeterTitle}>ՏԱՔՍՈՄԵՏՐ</Text><Text style={styles.taximeterFare}>{calculateTaxiFare(fareTripOrderId===o.id?fareDistanceMeters:0).toLocaleString("hy-AM")} ֏</Text><Text style={styles.taximeterInfo}>Ճանապարհ՝ {((fareTripOrderId===o.id?fareDistanceMeters:0)/1000).toFixed(2)} կմ · առաջին 2 կմ՝ 400 ֏, հետո՝ 100 ֏/կմ</Text></View><TouchableOpacity style={styles.outlineButton} onPress={() => updateOrderStatus(o.id, "completed")}><Text style={styles.outlineButtonText}>ԱՎԱՐՏԵԼ ՊԱՏՎԵՐԸ</Text></TouchableOpacity></> : null}
            </View>
          ))}
          {!availableOrders.length && !myOrders.some(o => ["accepted", "arrived", "started"].includes(o.status)) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Այս պահին պատվերներ չկան</Text>
              <Text style={styles.emptyText}>Նոր պատվերները ինքնաբերաբար կթարմացվեն։</Text>
            </View>
          ) : null}
        </>
      )}
    </>
  );
  const renderTasks = () =><><Text style={styles.pageTitle}>Առաջադրանքներ</Text><Text style={styles.pageSubtitle}>Բոնուսներ և օրվա նպատակներ</Text><View style={styles.infoCard}><Text style={styles.infoTitle}>Օրվա նպատակ</Text><Text style={styles.infoText}>Առաջադրանքները և բոնուսները կցուցադրվեն այստեղ՝ սերվերի միացումից հետո։</Text><View style={styles.progressTrack}><View style={styles.progressFill}/></View><Text style={styles.mutedSmall}>0 / 10 ուղևորություն</Text></View><Row title="Շաբաթական բոնուս" detail="Առաջընթացը դեռ հասանելի չէ" icon="★"/><Row title="Ակտիվության միավորներ" detail="Կհաշվարկվեն ուղևորություններից" icon="↗"/></>;
  const renderBalance = () =><><Text style={styles.pageTitle}>Հաշվեկշիռ</Text><Text style={styles.pageSubtitle}>Սերվերի հաշվեկշիռ և դիսպետչերի լիցքավորումներ</Text><View style={styles.balanceCard}><Text style={styles.balanceCaption}>ԸՆԴՀԱՆՈՒՐ ՀԱՇՎԵԿՇԻՌ</Text><Text style={styles.balanceValue}>{driverBalance.toLocaleString("hy-AM")} ֏</Text><Text style={styles.balanceFoot}>{balanceLoading?"Թարմացվում է...":authUser?"Տվյալները բեռնվում են TAXI LIDER սերվերից":"Մուտք գործիր՝ հաշվեկշիռը տեսնելու համար"}</Text></View><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>ԼԻՑՔԱՎՈՐՄԱՆ ՊԱՏՄՈՒԹՅՈՒՆ</Text></View>{!authUser?<View style={styles.emptyCard}><Text style={styles.emptyTitle}>Մուտք գործիր վարորդի հաշվով</Text></View>:balanceTransactions.length?balanceTransactions.map(tx=><View key={tx.id} style={[styles.infoCard,{marginTop:9}]}><Text style={styles.infoTitle}>+{Number(tx.amount).toLocaleString("hy-AM")} ֏</Text><Text style={styles.infoText}>{tx.note||"Դիսպետչերի լիցքավորում"} · {new Date(tx.created_at).toLocaleString("hy-AM")}</Text></View>):<View style={styles.emptyCard}><Text style={styles.emptyTitle}>{balanceLoading?"Բեռնվում է...":"Լիցքավորումներ դեռ չկան"}</Text><Text style={styles.emptyText}>Դիսպետչերի ավելացրած գումարները կհայտնվեն այստեղ։</Text></View>}</>;

  const submitDriverRegistration = async () => {
    if(!driverRegName.trim()||!driverRegPhone.trim()||driverRegPassword.length<8||!driverRegCar.trim()||!driverRegPlate.trim()||!driverRegLicense.trim()){Alert.alert("Լրացրու տվյալները","Լրացրու բոլոր դաշտերը, գաղտնաբառը՝ առնվազն 8 նիշ։");return;}
    setDriverRegBusy(true);
    try {
      const response=await fetch(API_BASE+"/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:driverRegName.trim(),phone:driverRegPhone.trim(),password:driverRegPassword,role:"driver",car_model:driverRegCar.trim(),plate_number:driverRegPlate.trim(),driver_license_number:driverRegLicense.trim()})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Գրանցումը չհաջողվեց");
      await AsyncStorage.setItem("taxi_lider_driver_token",data.token);
      setAuthToken(data.token);setAuthUser(data.user);setOnline(false);setDriverRegPassword("");setDriverRegMessage("Գրանցումը հաջող է։ Հաշիվը սպասում է դիսպետչերի հաստատմանը։");setProfileSection("");
      Alert.alert("Գրանցումն ուղարկված է","Հաշիվը պահպանվեց սերվերում։ Դիսպետչերը պետք է հաստատի այն։");
    } catch(e) { Alert.alert("Գրանցման սխալ",e.message||"Սերվերի հետ կապ չկա։"); }
    finally { setDriverRegBusy(false); }
  };

  useEffect(() => {
    if (!authToken || authUser?.role !== "driver" || profileSection !== "inspection") return;
    let active = true;
    apiRequest("/api/drivers/vehicle-checks").then(data => { if (active) { setVehicleCheckHistory(data.checks || []); setVehicleCheckDue(data.isDue !== false); setVehicleCheckDueAt(data.dueAt || null); } }).catch(() => {});
    return () => { active = false; };
  }, [authToken, authUser?.role, profileSection]);
  const submitVehicleCheck = async () => {
    if (!authToken) { Alert.alert("Մուտք գործիր", "Ստուգման համար մուտք գործիր վարորդի հաշվով։"); return; }
    const failed = Object.entries(vehicleCheck).filter(([, ok]) => !ok);
    if (failed.length && !vehicleCheckNote.trim()) { Alert.alert("Նշում է պետք", "Նկարագրիր հայտնաբերված խնդիրը։"); return; }
    setVehicleCheckBusy(true);
    try {
      await apiRequest("/api/drivers/vehicle-checks", { method: "POST", body: JSON.stringify({ checks: vehicleCheck, note: vehicleCheckNote.trim() }) });
      const data = await apiRequest("/api/drivers/vehicle-checks");
      setVehicleCheckHistory(data.checks || []); setVehicleCheckDue(data.isDue !== false); setVehicleCheckDueAt(data.dueAt || null); setVehicleCheckNote("");
      Alert.alert("Ստուգումն ուղարկված է", "Արդյունքը հասանելի է դիսպետչերին։");
    } catch (e) { Alert.alert("Սխալ", e.message || "Չհաջողվեց ուղարկել ստուգումը։"); }
    finally { setVehicleCheckBusy(false); }
  };
  const goBackProfile = () => setProfileSection("");
  const sectionHeader = (title) => <><TouchableOpacity style={styles.backButton} onPress={goBackProfile}><Text style={styles.backButtonText}>‹  ՀԵՏ</Text></TouchableOpacity><Text style={styles.pageTitle}>{title}</Text></>;
  const settingRow = (title, detail, value, setter) => <View style={styles.settingRow}><View style={{flex:1,paddingRight:12}}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><Switch value={value} onValueChange={setter} trackColor={{false:"#34445A",true:"#167D60"}} thumbColor={value?"#20D6A0":"#AAB5C2"}/></View>;
  const renderProfile = () => {
    if(profileSection==="login") return <>{sectionHeader("Վարորդի մուտք")}<Text style={styles.pageSubtitle}>Մուտք գործիր գրանցված վարորդի հաշվով</Text>{[[ "Հեռախոսահամար",authPhone,setAuthPhone ]].map(([label,value,setter])=><View key={label} style={{marginBottom:12}}><Text style={styles.rowDetail}>{label}</Text><TextInput value={value} onChangeText={setter} keyboardType="phone-pad" placeholder={label} placeholderTextColor="#708198" style={{backgroundColor:"#101E30",borderColor:"#30445B",borderWidth:1,borderRadius:11,color:"#FFFFFF",paddingHorizontal:13,paddingVertical:12,marginTop:6}} /></View>)}<Text style={styles.rowDetail}>Գաղտնաբառ</Text><TextInput value={authPassword} onChangeText={setAuthPassword} secureTextEntry placeholder="Գաղտնաբառ" placeholderTextColor="#708198" style={{backgroundColor:"#101E30",borderColor:"#30445B",borderWidth:1,borderRadius:11,color:"#FFFFFF",paddingHorizontal:13,paddingVertical:12,marginTop:6,marginBottom:16}}/><TouchableOpacity disabled={authBusy} onPress={loginDriver} style={{backgroundColor:"#20D6A0",padding:15,borderRadius:12,alignItems:"center",opacity:authBusy?0.6:1}}><Text style={{color:"#06251B",fontWeight:"900"}}>{authBusy?"ՄՈՒՏՔ...":"ՄՈՒՏՔ ԳՈՐԾԵԼ"}</Text></TouchableOpacity><TouchableOpacity onPress={()=>setProfileSection("register")} style={{marginTop:18,padding:12}}><Text style={{color:"#20D6A0",fontWeight:"800",textAlign:"center"}}>Դեռ հաշիվ չունե՞ս․ գրանցվել որպես վարորդ</Text></TouchableOpacity></>;
    if(profileSection==="register") return <>{sectionHeader("Վարորդի գրանցում")}<Text style={styles.pageSubtitle}>Լրացրու տվյալները․ դիսպետչերը կհաստատի հաշիվը</Text>{driverRegMessage?<View style={styles.infoCard}><Text style={styles.infoTitle}>Սպասում է հաստատման</Text><Text style={styles.infoText}>{driverRegMessage}</Text></View>:null}
      {[[ "Անուն և ազգանուն",driverRegName,setDriverRegName],["Հեռախոսահամար",driverRegPhone,setDriverRegPhone],["Մեքենայի մակնիշ և մոդել",driverRegCar,setDriverRegCar],["Մեքենայի համարանիշ",driverRegPlate,setDriverRegPlate],["Վարորդական վկայականի համար",driverRegLicense,setDriverRegLicense]].map(([label,value,setter])=><View key={label} style={{marginBottom:12}}><Text style={styles.rowDetail}>{label}</Text><TextInput value={value} onChangeText={setter} placeholder={label} placeholderTextColor="#708198" style={{backgroundColor:"#101E30",borderColor:"#30445B",borderWidth:1,borderRadius:11,color:"#FFFFFF",paddingHorizontal:13,paddingVertical:12,marginTop:6}} /></View>)}
      <Text style={styles.rowDetail}>Գաղտնաբառ (առնվազն 8 նիշ)</Text><TextInput value={driverRegPassword} onChangeText={setDriverRegPassword} secureTextEntry placeholder="Ստեղծիր գաղտնաբառ" placeholderTextColor="#708198" style={{backgroundColor:"#101E30",borderColor:"#30445B",borderWidth:1,borderRadius:11,color:"#FFFFFF",paddingHorizontal:13,paddingVertical:12,marginTop:6,marginBottom:16}} />
      <TouchableOpacity disabled={driverRegBusy} onPress={submitDriverRegistration} style={{backgroundColor:"#20D6A0",padding:15,borderRadius:12,alignItems:"center",opacity:driverRegBusy?0.6:1}}><Text style={{color:"#06251B",fontWeight:"900"}}>{driverRegBusy?"ԳՐԱՆՑՎՈՒՄ Է...":"ՍՏԵՂԾԵԼ ՎԱՐՈՐԴԻ ՀԱՇԻՎ"}</Text></TouchableOpacity>
      <Text style={[styles.rowDetail,{marginTop:12}]}>Գրանցվելուց հետո հաշիվը կմնա սպասման մեջ, մինչև դիսպետչերը հաստատի այն։</Text></>;

    if (profileSection === "inspection") return <>{sectionHeader("Մեքենայի ստուգում՝ 15 օրը մեկ")}<Text style={styles.pageSubtitle}>Պարտադիր ստուգումը կատարվում է յուրաքանչյուր 15 օրը մեկ։ Արդյունքը կուղարկվի դիսպետչերին։</Text><View style={styles.infoCard}><Text style={styles.infoTitle}>{vehicleCheckDue?"Ստուգումը պետք է անցնել":"Ստուգումն ուժի մեջ է"}</Text><Text style={styles.infoText}>{vehicleCheckDue?"Անցիր մեքենայի ստուգումը և ուղարկիր արդյունքը։":("Հաջորդ ստուգման օրը՝ "+new Date(vehicleCheckDueAt).toLocaleDateString("hy-AM"))}</Text></View>{[["brakes","Արգելակներ"],["tires","Անվադողեր"],["lights","Լույսեր"],["signals","Շրջադարձի ազդանշաններ"],["mirrors","Հայելիներ"],["seatbelts","Անվտանգության գոտիներ"],["documents","Փաստաթղթեր և ապահովագրություն"]].map(([key,label])=><View key={key} style={styles.settingRow}><View style={{flex:1,paddingRight:10}}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.rowDetail}>{vehicleCheck[key]?"Ստուգված է":"Խնդիր կա / ստուգված չէ"}</Text></View><Switch value={vehicleCheck[key]} onValueChange={value=>setVehicleCheck(old=>({...old,[key]:value}))} trackColor={{false:"#672B3B",true:"#167D60"}} thumbColor={vehicleCheck[key]?"#20D6A0":"#AAB5C2"}/></View>)}<Text style={[styles.rowDetail,{marginTop:14}]}>Հայտնաբերված խնդիր կամ նշում</Text><TextInput value={vehicleCheckNote} onChangeText={setVehicleCheckNote} multiline placeholder="Նկարագրիր խնդիրը, եթե կա..." placeholderTextColor="#708198" style={{minHeight:76,textAlignVertical:"top",backgroundColor:"#101E30",borderColor:"#30445B",borderWidth:1,borderRadius:11,color:"#FFFFFF",padding:12,marginTop:6,marginBottom:14}}/><TouchableOpacity disabled={vehicleCheckBusy||!vehicleCheckDue} onPress={submitVehicleCheck} style={{backgroundColor:vehicleCheckDue?"#20D6A0":"#34445A",padding:15,borderRadius:12,alignItems:"center",opacity:vehicleCheckBusy?0.6:1}}><Text style={{color:vehicleCheckDue?"#06251B":"#D3DCE7",fontWeight:"900"}}>{vehicleCheckBusy?"ՈՒՂԱՐԿՎՈՒՄ Է...":vehicleCheckDue?"ՈՒՂԱՐԿԵԼ ԴԻՍՊԵՏՉԵՐԻՆ":"ՍՏՈՒԳՈՒՄԸ ԴԵՌ ՎԱՎԵՐ Է"}</Text></TouchableOpacity><Text style={[styles.sectionTitle,{marginTop:22,marginBottom:8}]}>ՎԵՐՋԻՆ ՍՏՈՒԳՈՒՄՆԵՐ</Text>{vehicleCheckHistory.length?vehicleCheckHistory.map(item=><View key={item.id} style={[styles.infoCard,{marginTop:8}]}><Text style={styles.infoTitle}>{item.status==="passed"?"✓ Ստուգումն անցած է":"⚠ Խնդիր է նշվել"}</Text><Text style={styles.infoText}>{new Date(item.created_at).toLocaleString("hy-AM")}{item.note?" · "+item.note:""}</Text></View>):<View style={styles.emptyCard}><Text style={styles.emptyText}>Ուղարկված ստուգումներ դեռ չկան։</Text></View>}</>;
    if (profileSection === "settings") return <>{sectionHeader("Կարգավորումներ")}<Text style={styles.pageSubtitle}>Կառավարիր հավելվածի նախընտրությունները</Text>{settingRow("Ծանուցումներ","Պատվերների և համակարգի ծանուցումներ",notificationsEnabled,setNotificationsEnabled)}{settingRow("Ձայնային ազդանշան","Նոր իրադարձությունների ձայն",soundEnabled,setSoundEnabled)}{settingRow("Մուգ քարտեզ","Քարտեզի մուգ տեսք",darkMapEnabled,setDarkMapEnabled)}<View style={styles.settingRow}><View style={{flex:1,paddingRight:10}}><Text style={styles.rowTitle}>Քարտեզի տեսակ</Text><Text style={styles.rowDetail}>Ընտրիր սովորական կամ արբանյակային քարտեզը</Text></View></View><View style={{flexDirection:"row",gap:9,marginTop:8}}><TouchableOpacity onPress={()=>{setMapStyle("light");mapRef.current?.injectJavaScript("window.axasMapStyle && window.axasMapStyle('light'); true;");}} style={{flex:1,padding:13,borderRadius:12,alignItems:"center",backgroundColor:mapStyle==="light"?"#20D6A0":"#17263A",borderWidth:1,borderColor:mapStyle==="light"?"#20D6A0":"#34465A"}}><Text style={{color:mapStyle==="light"?"#06251B":"#FFFFFF",fontWeight:"900",fontSize:11}}>ՍՈՎՈՐԱԿԱՆ</Text></TouchableOpacity><TouchableOpacity onPress={()=>{setMapStyle("satellite");mapRef.current?.injectJavaScript("window.axasMapStyle && window.axasMapStyle('satellite'); true;");}} style={{flex:1,padding:13,borderRadius:12,alignItems:"center",backgroundColor:mapStyle==="satellite"?"#20D6A0":"#17263A",borderWidth:1,borderColor:mapStyle==="satellite"?"#20D6A0":"#34465A"}}><Text style={{color:mapStyle==="satellite"?"#06251B":"#FFFFFF",fontWeight:"900",fontSize:11}}>ԱՐԲԱՆՅԱԿԱՅԻՆ</Text></TouchableOpacity></View><Row title="Տեղադրության թույլտվություն" detail="GPS-ը կառավարիր հեռախոսի կարգավորումներից" icon="◎" onPress={()=>Alert.alert("Տեղադրություն","Միացրու հեռախոսի GPS-ը և AXAS Driver-ի տեղադրության թույլտվությունը։")}/><Row title="Հավելվածի մասին" detail="AXAS Driver • 1.0.0" icon="ⓘ" onPress={()=>Alert.alert("AXAS Driver","Վարորդի հավելվածի ցուցադրական տարբերակ։")}/></>;
    if (profileSection === "personal") return <>{sectionHeader("Անձնական տվյալներ")}<Text style={styles.pageSubtitle}>Վարորդի տվյալների կառավարում</Text><View style={styles.infoCard}><Text style={styles.infoTitle}>Անձնական տվյալների խմբագրում</Text><Text style={styles.infoText}>Անունը, հեռախոսահամարը և լուսանկարը կպահպանվեն, երբ միացվի օգտատերերի սերվերը։</Text></View><Row title="Անուն և ազգանուն" detail="Դեռ լրացված չէ" icon="●" onPress={()=>Alert.alert("Անձնական տվյալներ","Տվյալների պահպանումը հասանելի կլինի հաշվի սերվերը միացնելուց հետո։")}/><Row title="Հեռախոսահամար" detail="Չի հաստատվել" icon="☎" onPress={()=>Alert.alert("Հեռախոս","Հեռախոսահամարի հաստատման համար անհրաժեշտ է սերվեր։")}/></>;
    if (profileSection === "car") return <>{sectionHeader("Մեքենայի տվյալներ")}<Text style={styles.pageSubtitle}>Մեքենայի տվյալներ և գրանցում</Text><View style={styles.infoCard}><Text style={styles.infoTitle}>Մեքենան դեռ գրանցված չէ</Text><Text style={styles.infoText}>Մակնիշը, մոդելը, գույնը և համարանիշը կավելացվեն վարորդի հաշվի գրանցման ժամանակ։</Text></View><Row title="Ավելացնել մեքենա" detail="Մակնիշ, մոդել, գույն, համարանիշ" icon="＋" onPress={()=>Alert.alert("Մեքենայի գրանցում","Մեքենայի տվյալների անվտանգ պահպանման համար պետք է միացնել սերվերը։")}/></>;
    if (profileSection === "documents") return <>{sectionHeader("Փաստաթղթեր")}<Text style={styles.pageSubtitle}>Վարորդի անհրաժեշտ փաստաթղթեր</Text>{["Վարորդական իրավունք","Մեքենայի գրանցման վկայական","Ապահովագրություն","Անձը հաստատող փաստաթուղթ"].map((x)=><Row key={x} title={x} detail="Վերբեռնումը հասանելի կլինի հաշվի սերվերը միացնելուց հետո" icon="▤" onPress={()=>Alert.alert(x,"Փաստաթղթերի վերբեռնումը դեռ միացված չէ։")}/>)}</>;
    if (profileSection === "tariffs") return <>{sectionHeader("Սակագներ")}<Text style={styles.pageSubtitle}>Ծառայության տեսակներ և պայմաններ</Text><View style={styles.infoCard}><Text style={styles.infoTitle}>Սակագները դեռ չեն բեռնվել</Text><Text style={styles.infoText}>Գները և ծառայության պայմանները պետք է ստացվեն կենտրոնական սերվերից, որպեսզի միշտ ճիշտ լինեն։</Text></View><Row title="Սակագների թարմացում" detail="Սերվերի միացումից հետո" icon="↻" onPress={()=>Alert.alert("Սակագներ","Սակագների իրական տվյալները դեռ հասանելի չեն։")}/></>;
    if (profileSection === "rating") return <>{sectionHeader("Վարորդի վարկանիշ")}<Text style={styles.pageSubtitle}>Գնահատիր քո ծառայության որակը</Text><View style={styles.infoCard}><Text style={styles.infoTitle}>Քո գնահատականը</Text><View style={{flexDirection:"row",justifyContent:"center",gap:8,marginTop:16}}>{[1,2,3,4,5].map(n=><Text key={n} style={{fontSize:34,color:n<=Math.round(Number(authUser?.driver_rating ?? 5))?"#F6C453":"#526176"}}>★</Text>)}</View><Text style={[styles.infoText,{textAlign:"center"}]}>{Number(authUser?.driver_rating ?? 5).toFixed(1)} / 5 • Գնահատականը պահպանվում է սերվերում</Text></View></>;
    if (profileSection === "priority") return <>{sectionHeader("Առաջնահերթություն")}<Text style={styles.pageSubtitle}>Սկզբնական միավորը՝ 20։ Յուրաքանչյուր ավարտված ուղևորությունից հետո ավելանում է 5 միավոր։</Text><View style={styles.infoCard}><Text style={styles.infoTitle}>Քո առաջնահերթությունը</Text><Text style={{color:"#20D6A0",fontSize:32,fontWeight:"900",textAlign:"center",marginTop:12}}>{Number(authUser?.driver_priority ?? 20)}</Text><Text style={[styles.infoText,{textAlign:"center"}]}>Ավտոմատ թարմացվում է սերվերում։</Text></View></>;
    if (profileSection === "support") return <>{sectionHeader("Օգնություն և աջակցություն")}<Text style={styles.pageSubtitle}>Օգնություն վարորդին</Text><Row title="Հաճախ տրվող հարցեր" detail="Հավելվածի օգտագործում" icon="?" onPress={()=>Alert.alert("Օգնություն","GPS-ի համար միացրու տեղադրությունը և թույլ տուր հավելվածին օգտվել դրանից։")}/><Row title="Կապ օպերատորի հետ" detail="Աջակցման կապուղին դեռ կարգավորված չէ" icon="☎" onPress={()=>Alert.alert("Աջակցություն","Օպերատորի հեռախոսահամարը պետք է ավելացվի սերվերի կարգավորումներում։")}/><Row title="Տեղեկացնել խնդրի մասին" detail="Սխալների հաղորդում" icon="!" onPress={()=>Alert.alert("Հաղորդում","Խնդրի ավտոմատ ուղարկումը կավելացվի սերվերի միացումից հետո։")}/></>;
    return <><Text style={styles.pageTitle}>Իմ պրոֆիլը</Text><Text style={styles.pageSubtitle}>Վարորդի տվյալներ և կարգավորումներ</Text><View style={styles.profileCard}><View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>{(authUser?.name||"T").slice(0,1).toUpperCase()}</Text></View><Text style={styles.profileName}>{authUser?.name||"Taxi Lider վարորդ"}</Text><Text style={styles.profileStatus}>{authUser ? (authUser.approval_status==="approved"?"Հաստատված վարորդ":authUser.approval_status==="rejected"?"Գրանցումը մերժված է":"Սպասում է դիսպետչերի հաստատմանը") : "Մուտք գործիր կամ գրանցվիր"}</Text><View style={styles.profileMetrics}><View style={styles.profileMetric}><Text style={styles.profileMetricValue}>★ {(Number(authUser?.driver_rating ?? 5)).toFixed(1)}</Text><Text style={styles.profileMetricLabel}>ՎԱՐԿԱՆԻՇ</Text></View><View style={styles.profileMetricDivider}/><View style={styles.profileMetric}><Text style={styles.profileMetricValue}>{Number(authUser?.driver_activity ?? 30)}</Text><Text style={styles.profileMetricLabel}>ԱԿՏԻՎՈՒԹՅՈՒՆ</Text></View><View style={styles.profileMetricDivider}/><View style={styles.profileMetric}><Text style={styles.profileMetricValue}>{Number(authUser?.driver_priority ?? 20)}</Text><Text style={styles.profileMetricLabel}>ԱՌԱՋՆԱՀԵՐԹՈՒԹՅՈՒՆ</Text></View></View></View>{authUser ? <Row title="Դուրս գալ հաշվից" detail={authUser.phone||""} icon="↪" onPress={logoutDriver}/> : <><Row title="Մուտք գործել որպես վարորդ" detail="Հեռախոսահամար և գաղտնաբառ" icon="→" onPress={()=>setProfileSection("login")}/><Row title="Գրանցվել որպես վարորդ" detail="Ստեղծել նոր վարորդի հաշիվ" icon="＋" onPress={()=>setProfileSection("register")}/></>}<Row title="Անձնական տվյալներ" detail="Անուն, հեռախոս և լուսանկար" icon="●" onPress={()=>setProfileSection("personal")}/><Row title="Մեքենայի ամենօրյա ստուգում" detail="Արգելակներ, անվադողեր, լույսեր և անվտանգություն" icon="✓" onPress={()=>setProfileSection("inspection")}/><Row title="Փաստաթղթեր" detail="Վարորդական իրավունք և գրանցում" icon="▤" onPress={()=>setProfileSection("documents")}/><Row title="Սակագներ" detail="Ծառայության տեսակներ" icon="₽" onPress={()=>setProfileSection("tariffs")}/><Row title="Կարգավորումներ" detail="Ծանուցումներ և հավելված" icon="⚙" onPress={()=>setProfileSection("settings")}/><Row title="Օգնություն և աջակցություն" detail="Կապ օպերատորի հետ" icon="?" onPress={()=>setProfileSection("support")}/><Row title="Վարկանիշ" detail="Վարորդի գնահատական" icon="★" onPress={()=>setProfileSection("rating")}/><Row title="Առաջնահերթություն" detail="Պատվերների նախընտրություններ" icon="⇧" onPress={()=>setProfileSection("priority")}/><Row title="Դուրս գալ հաշվից" detail="Դուրս գալ վարորդի հաշվից" icon="↪" onPress={()=>Alert.alert("Դուրս գալ հաշվից","Հաշվից դուրս գալու գործառույթը կակտիվանա, երբ միացվի մուտքի և հաշիվների սերվերը։")}/></>;
  };

  const screens = {orders:renderOrders, tasks:renderTasks, balance:renderBalance, profile:renderProfile};
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor="#080E19"/>
    {tab === "home" ? <View style={styles.fullMap}><WebView ref={mapRef} style={StyleSheet.absoluteFillObject} source={{ html: mapHtml, baseUrl: "https://localhost" }} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled mixedContentMode="always" setSupportMultipleWindows={false} cacheEnabled onMessage={(event) => { if (event.nativeEvent.data === "MAP_READY") setMapReady(true); }} /><View style={styles.driverHomeHeader}>
      <View><Text style={styles.driverHomeStatus}>{online ? "Դու առցանց ես" : "Դու անցանց ես"}</Text><Text style={styles.driverHomeHint}>{online ? "Փնտրում ենք պատվերներ" : "Պատվերների որոնումն անջատված է"}</Text></View>
      <TouchableOpacity style={styles.driverSettingsButton} onPress={()=>{setTab("profile");setProfileSection("settings");}}><Text style={styles.driverSettingsGlyph}>☷</Text></TouchableOpacity>
    </View>
    {fareTripOrderId ? <View style={styles.mapTaximeterBadge}><Text style={styles.mapTaximeterLabel}>ՏԱՔՍՈՄԵՏՐ</Text><Text style={styles.mapTaximeterFare}>{calculateTaxiFare(fareDistanceMeters).toLocaleString("hy-AM")} ֏</Text><Text style={styles.mapTaximeterKm}>{(fareDistanceMeters/1000).toFixed(2)} կմ</Text></View> : null}
    <View style={styles.mapControlsFull}><TouchableOpacity style={styles.lightMapControl} onPress={() => zoomMap(0.55)}><Text style={styles.lightMapControlText}>＋</Text></TouchableOpacity><TouchableOpacity style={styles.lightMapControl} onPress={() => zoomMap(1.8)}><Text style={styles.lightMapControlText}>−</Text></TouchableOpacity><TouchableOpacity style={styles.lightMapControl} onPress={() => mapRef.current?.injectJavaScript("window.axasLocate && window.axasLocate(); true;")}><Text style={styles.lightMapControlText}>➤</Text></TouchableOpacity></View>
    <Animated.View style={[styles.driverBottomSheet,{height:sheetAnim.interpolate({inputRange:[0,1],outputRange:[126,440]})}]}>
      <View style={styles.sheetDragArea} {...sheetPan.panHandlers}><View style={styles.sheetDragHandle}/></View>
      {sheetExpanded ? <> 
      <View style={styles.driverStatsRow}>
        <TouchableOpacity style={styles.driverStat} onPress={()=>{setTab("profile");setProfileSection("priority");}}><Text style={styles.driverStatLabel}>Առաջնահերթություն</Text><Text style={styles.driverStatValue}>＋{Number(authUser?.driver_priority ?? 20)}</Text></TouchableOpacity>
        <View style={styles.driverStatDivider}/>
        <TouchableOpacity style={styles.driverStat} onPress={()=>setTab("balance")}><Text style={styles.driverStatLabel}>Հաշվեկշիռ</Text><Text style={styles.driverStatValue}>{Number(driverBalance||0).toLocaleString("hy-AM")} ֏</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.driverInfoTile} onPress={()=>setTab("orders")}><View style={{flex:1}}><Text style={styles.driverInfoTitle}>{availableOrders.length ? "Կան նոր պատվերներ" : "Այս պահին ակտիվ պատվերներ չկան"}</Text><Text style={styles.driverInfoSubtitle}>{availableOrders.length ? "Բացիր և ընդունիր հարմար պատվերը" : "Կտեղեկացնենք, երբ պատվերներ հայտնվեն"}</Text></View><Text style={styles.driverChevron}>›</Text></TouchableOpacity>
      <TouchableOpacity style={styles.driverInfoTile} onPress={()=>setTab("orders")}><View style={{flex:1}}><Text style={styles.driverInfoTitle}>Իմ ուղևորությունները</Text><Text style={styles.driverInfoSubtitle}>Ընթացիկ՝ {myOrders.filter(o=>["accepted","arrived","started"].includes(o.status)).length} · Նոր առաջարկներ՝ {availableOrders.length}</Text></View><Text style={styles.driverChevron}>›</Text></TouchableOpacity>
      </> : null}
      <TouchableOpacity onPress={toggleOnline} activeOpacity={0.88} style={[styles.goOnlineButton, !sheetExpanded && styles.goOnlineButtonCompact,online&&styles.goOnlineButtonActive]}><View style={[styles.goOnlineCircle,!sheetExpanded&&styles.goOnlineCircleCompact]}><Text style={[styles.goOnlineArrow,!sheetExpanded&&styles.goOnlineArrowCompact]}>{online ? "Ⅱ" : "➜"}</Text></View><View style={{flex:1,alignItems:"center"}}><Text style={styles.goOnlineSmall}>{online ? "Առցանց" : "Անցանց"}</Text><Text style={[styles.goOnlineText,!sheetExpanded&&styles.goOnlineTextCompact]}>{online ? "ԴՈՒՐՍ ԳԱԼ ԳԾԻՑ" : "ԴՈՒՐՍ ԳԱԼ ԳԻԾ"}</Text></View></TouchableOpacity>
    </Animated.View></View> : <View style={{flex:1}}><View style={styles.topBar}><Text style={styles.brand}>TAXI <Text style={styles.brandAccent}>LIDER</Text></Text><View style={[styles.topStatus, online && styles.topStatusOn]}><View style={[styles.tinyDot, online && styles.statusDotOn]} /><Text style={styles.topStatusText}>{online ? "Առցանց" : "Անցանց"}</Text></View></View><ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{screens[tab]()}</ScrollView></View>}
    <View style={styles.tabBar}>{TABS.map(item =><TouchableOpacity key={item.id} style={[styles.tabItem, item.id==="tasks" && styles.tabCenter]} onPress={() => setTab(item.id)}>{item.id==="tasks" ? <View style={styles.tabCenterIcon}><Text style={{fontSize:22,color:"#061810",fontWeight:"900"}}>{item.icon}</Text></View> : <Text style={[styles.tabIcon, tab===item.id && styles.tabActive]}>{item.icon}</Text>}<Text style={[styles.tabLabel, tab===item.id && styles.tabActive]}>{item.label}</Text>{tab===item.id && <View style={styles.tabIndicator}/>}</TouchableOpacity>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFFFFF"},
  fullMap:{flex:1,backgroundColor:"#F2F2F0"},
  driverHomeHeader:{position:"absolute",top:10,left:18,right:18,zIndex:20,flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between"},
  driverHomeStatus:{fontSize:25,fontWeight:"900",color:"#111111"},
  driverHomeHint:{fontSize:14,fontWeight:"600",color:"#222222",marginTop:2},
  driverSettingsButton:{width:58,height:58,borderRadius:29,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center",elevation:5,shadowColor:"#000",shadowOpacity:.12,shadowRadius:8},
  driverSettingsGlyph:{fontSize:30,color:"#111111"},
  lightMapControl:{width:54,height:54,borderRadius:27,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center",elevation:5,shadowColor:"#000",shadowOpacity:.12,shadowRadius:7},
  lightMapControlText:{fontSize:29,color:"#111111",fontWeight:"600"},
  driverBottomSheet:{position:"absolute",left:0,right:0,bottom:0,backgroundColor:"#FFFFFF",borderTopLeftRadius:26,borderTopRightRadius:26,paddingHorizontal:22,paddingTop:5,paddingBottom:12,elevation:18,shadowColor:"#000",shadowOpacity:.13,shadowRadius:14,overflow:"hidden"},
  sheetDragArea:{height:24,alignItems:"center",justifyContent:"center"},sheetDragHandle:{width:42,height:5,borderRadius:3,backgroundColor:"#C9C9C9"},
  driverStatsRow:{flexDirection:"row",alignItems:"center",paddingBottom:16,marginBottom:12,borderBottomWidth:1,borderBottomColor:"#E6E6E6"},
  driverStat:{flex:1,paddingHorizontal:10},
  driverStatLabel:{fontSize:13,color:"#333333"},
  driverStatValue:{fontSize:24,color:"#111111",fontWeight:"900",marginTop:1},
  driverStatDivider:{width:1,height:48,backgroundColor:"#DDDDDD"},
  driverInfoTile:{minHeight:72,backgroundColor:"#F4F3F1",borderRadius:20,paddingHorizontal:17,paddingVertical:13,marginBottom:10,flexDirection:"row",alignItems:"center"},
  driverInfoTitle:{fontSize:15,color:"#171717",fontWeight:"800"},
  driverInfoSubtitle:{fontSize:12,color:"#888888",marginTop:3},
  driverChevron:{fontSize:30,color:"#111111",marginLeft:10},
  goOnlineButton:{height:104,backgroundColor:"#FFE000",borderRadius:54,marginTop:6,flexDirection:"row",alignItems:"center",padding:7},
  goOnlineButtonActive:{backgroundColor:"#D7F3E4"},
  goOnlineButtonCompact:{height:76,marginTop:0,padding:5},goOnlineCircleCompact:{width:64,height:64,borderRadius:32},goOnlineArrowCompact:{fontSize:34},goOnlineTextCompact:{fontSize:14},
  goOnlineCircle:{width:88,height:88,borderRadius:44,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center"},
  goOnlineArrow:{fontSize:45,color:"#111111",fontWeight:"700"},
  goOnlineSmall:{fontSize:13,color:"#111111"},
  goOnlineText:{fontSize:17,color:"#111111",fontWeight:"900",marginTop:1},
  
  safe:{flex:1,backgroundColor:"#FFFFFF"},
  fullMap:{flex:1,backgroundColor:"#F2F2F0"},
  mapTopOverlay:{position:"absolute",top:10,left:12,right:12,flexDirection:"row",alignItems:"flex-start",justifyContent:"flex-end"},
  nativeLeaveRoute:{position:"absolute",bottom:70,alignSelf:"center",zIndex:99999,elevation:40,backgroundColor:"#20D6A0",paddingHorizontal:22,paddingVertical:13,borderRadius:14,borderWidth:1,borderColor:"#FFFFFF",shadowColor:"#000",shadowOpacity:.3,shadowRadius:8,shadowOffset:{width:0,height:3}},nativeLeaveRouteText:{color:"#06251B",fontSize:12,fontWeight:"900",letterSpacing:.4},
  addressSearchWrap:{position:"absolute",top:112,left:12,right:12,width:undefined,zIndex:99999,elevation:40,alignItems:"stretch"},addressSearchRow:{width:"100%",flexDirection:"row",alignItems:"center",backgroundColor:"#091321F2",borderRadius:14,borderWidth:1,borderColor:"#20D6A0",padding:5},addressInput:{flex:1,color:"#FFFFFF",fontSize:13,paddingHorizontal:11,paddingVertical:9},addressSearchButton:{backgroundColor:"#20D6A0",paddingHorizontal:14,paddingVertical:12,borderRadius:10},addressSearchButtonText:{color:"#061810",fontSize:10,fontWeight:"900"},addressResults:{position:"absolute",top:54,left:0,right:0,width:"100%",backgroundColor:"#091321F5",borderRadius:12,borderWidth:1,borderColor:"#40536B",overflow:"hidden"},addressResult:{paddingHorizontal:12,paddingVertical:11,borderBottomWidth:1,borderBottomColor:"#26364B"},addressResultText:{color:"#FFFFFF",fontSize:11,lineHeight:16},
  mapStyleSwitch:{position:"absolute",left:0,top:56,flexDirection:"row",gap:6},mapStyleButton:{backgroundColor:"#091321E8",paddingHorizontal:11,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:"#40536B"},mapStyleText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"},
  mapBrand:{backgroundColor:"#091321E8",paddingHorizontal:10,paddingVertical:7,borderRadius:11,borderWidth:1,borderColor:"#26364B"},mapBrandTitle:{fontSize:14,fontWeight:"900",letterSpacing:.8,color:"#F5F8FC"},
  mapGps:{color:"#20D6A0",fontSize:8,fontWeight:"900",letterSpacing:1,marginTop:3},
  mapOnlineButton:{flexDirection:"row",alignItems:"center",gap:7,backgroundColor:"#101D2DEB",paddingHorizontal:14,paddingVertical:12,borderRadius:13,borderWidth:1,borderColor:"#39485C"},
  mapOnlineButtonOn:{backgroundColor:"#10372E",borderColor:"#20D6A0"},
  mapOnlineText:{color:"#FFFFFF",fontSize:10,fontWeight:"900",letterSpacing:.8},
  mapTaximeterBadge:{position:"absolute",top:78,left:12,backgroundColor:"#091321F2",borderWidth:1,borderColor:"#20D6A0",borderRadius:14,paddingHorizontal:14,paddingVertical:9,minWidth:126,elevation:8},mapTaximeterLabel:{color:"#A7B7C9",fontSize:9,fontWeight:"900"},mapTaximeterFare:{color:"#20D6A0",fontSize:22,fontWeight:"900",marginTop:2},mapTaximeterKm:{color:"#FFFFFF",fontSize:10,marginTop:1},
  taximeterCard:{marginTop:10,backgroundColor:"#0B2924",borderColor:"#20D6A0",borderWidth:1,borderRadius:12,padding:13},taximeterTitle:{color:"#A7B7C9",fontSize:10,fontWeight:"900",letterSpacing:1},taximeterFare:{color:"#20D6A0",fontSize:27,fontWeight:"900",marginTop:4},taximeterInfo:{color:"#D5E3E0",fontSize:11,marginTop:4},
  driverWalletBadge:{position:"absolute",top:78,right:12,backgroundColor:"#091321F2",borderWidth:1,borderColor:"#20D6A0",borderRadius:14,paddingHorizontal:14,paddingVertical:9,minWidth:132,alignItems:"flex-end",elevation:8,shadowColor:"#000",shadowOpacity:.25,shadowRadius:8,shadowOffset:{width:0,height:3}},driverWalletLabel:{color:"#A7B7C9",fontSize:9,fontWeight:"900",letterSpacing:.6},driverWalletValue:{color:"#20D6A0",fontSize:21,fontWeight:"900",marginTop:2},
  driverRatingBadge:{position:"absolute",top:145,right:12,backgroundColor:"#091321F2",borderWidth:1,borderColor:"#E9B949",borderRadius:14,paddingHorizontal:14,paddingVertical:8,minWidth:132,alignItems:"flex-end",elevation:8,shadowColor:"#000",shadowOpacity:.25,shadowRadius:8,shadowOffset:{width:0,height:3}},driverRatingLabel:{color:"#A7B7C9",fontSize:9,fontWeight:"900",letterSpacing:.6},driverRatingValue:{color:"#E9B949",fontSize:20,fontWeight:"900",marginTop:2},
  speedBadge:{position:"absolute",left:12,bottom:16,flexDirection:"row",alignItems:"baseline",gap:5,backgroundColor:"#FFFFFFF2",paddingHorizontal:15,paddingVertical:10,borderRadius:15,borderWidth:1,borderColor:"#D9E2EA",elevation:7,shadowColor:"#000",shadowOpacity:.15,shadowRadius:8,shadowOffset:{width:0,height:3}},speedValue:{fontSize:25,fontWeight:"900",color:"#142536"},speedUnit:{fontSize:11,fontWeight:"800",color:"#536477"},mapAttribution:{position:"absolute",left:9,bottom:8,backgroundColor:"#FFFFFFD9",paddingHorizontal:7,paddingVertical:4,borderRadius:5},
  mapAttributionText:{color:"#526273",fontSize:8},
  mapControlsFull:{position:"absolute",right:14,top:"34%",gap:10,zIndex:15},
  topBar:{height:58,paddingHorizontal:19,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#182438"},
  brand:{fontSize:17,fontWeight:"900",letterSpacing:0.8,color:"#F5F8FC"},brandAccent:{color:"#20D6A0"},
  topStatus:{flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:11,paddingVertical:7,borderRadius:20,backgroundColor:"#222D3D"},topStatusOn:{backgroundColor:"#10372E"},
  tinyDot:{width:7,height:7,borderRadius:5,backgroundColor:"#8B98A9"},topStatusText:{fontSize:11,color:"#E5EDF5",fontWeight:"700"},
  scroll:{flex:1},content:{paddingHorizontal:15,paddingTop:17,paddingBottom:22},
  welcomeLine:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  eyebrow:{fontSize:9,color:"#8291A7",fontWeight:"800",letterSpacing:1.4},pageTitle:{fontSize:23,color:"#F6F8FC",fontWeight:"900",marginTop:4},pageSubtitle:{fontSize:12,color:"#8492A8",marginTop:5,marginBottom:18},
  avatar:{width:42,height:42,borderRadius:15,backgroundColor:"#14283A",borderWidth:1,borderColor:"#20D6A0",alignItems:"center",justifyContent:"center"},avatarText:{color:"#20D6A0",fontSize:20,fontWeight:"900"},
  statusCard:{backgroundColor:"#121E2F",borderRadius:18,padding:15,flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:"#24344A"},
  statusLabelLine:{flexDirection:"row",alignItems:"center",gap:7},statusDot:{width:7,height:7,borderRadius:5,backgroundColor:"#8794A6"},statusDotOn:{backgroundColor:"#20D6A0"},
  statusLabel:{color:"#92A1B6",fontSize:9,fontWeight:"900",letterSpacing:1},statusHeadline:{color:"#F5F8FC",fontSize:16,fontWeight:"800",marginTop:7},statusHint:{color:"#8391A6",fontSize:10,marginTop:4},
  goButton:{backgroundColor:"#20D6A0",paddingHorizontal:18,paddingVertical:13,borderRadius:12,marginLeft:8},stopButton:{backgroundColor:"#34465A"},goButtonText:{fontSize:11,fontWeight:"900",color:"#061810",letterSpacing:.5},
  metricsCard:{marginTop:10,backgroundColor:"#111B2B",borderRadius:16,paddingVertical:14,flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:"#1F2D41"},
  metric:{flex:1,alignItems:"center"},metricValue:{color:"#F7FAFD",fontSize:17,fontWeight:"900"},metricLabel:{color:"#8291A7",fontSize:9,marginTop:5,textAlign:"center"},metricDivider:{width:1,height:28,backgroundColor:"#2A394D"},
  sectionHeading:{marginTop:19,marginBottom:9,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},sectionTitle:{color:"#EAF0F7",fontSize:10,fontWeight:"900",letterSpacing:1.1},liveTag:{color:"#20D6A0",fontSize:10,fontWeight:"800"},
  mapCard:{height:315,borderRadius:18,overflow:"hidden",borderWidth:1,borderColor:"#26364B"},map:{flex:1},driverMarker:{width:30,height:30,borderRadius:15,backgroundColor:"#20D6A0",borderWidth:3,borderColor:"#FFFFFF",alignItems:"center",justifyContent:"center",elevation:8},driverArrow:{width:0,height:0,borderLeftWidth:5,borderRightWidth:5,borderBottomWidth:11,borderLeftColor:"transparent",borderRightColor:"transparent",borderBottomColor:"#06251B"},routePill:{position:"absolute",left:11,bottom:11,flexDirection:"row",alignItems:"center",backgroundColor:"#0C1728E8",paddingHorizontal:10,paddingVertical:8,borderRadius:10,gap:7},routePillText:{color:"#20D6A0",fontSize:11,fontWeight:"900"},routeDash:{width:18,height:2,backgroundColor:"#20D6A0"},routeCaption:{color:"#EAF4F7",fontSize:9,fontWeight:"700"},mapControls:{position:"absolute",right:10,bottom:10,gap:7},mapControl:{width:46,height:46,borderRadius:14,backgroundColor:"#0C1728F0",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#40536B",elevation:6},mapControlText:{color:"#FFFFFF",fontSize:25,fontWeight:"900"},mapPill:{position:"absolute",top:11,left:11,backgroundColor:"#0C1728E8",paddingHorizontal:10,paddingVertical:7,borderRadius:8},mapPillText:{fontSize:9,color:"#EAF4F7",fontWeight:"900",letterSpacing:.8},
  infoCard:{backgroundColor:"#121E2F",borderRadius:16,padding:16,borderWidth:1,borderColor:"#24344A"},infoTitle:{color:"#F4F7FB",fontSize:14,fontWeight:"800"},infoText:{color:"#8D9CB0",fontSize:11,lineHeight:17,marginTop:7},
  emptyCard:{marginTop:12,backgroundColor:"#111C2C",borderRadius:18,padding:23,alignItems:"center",borderWidth:1,borderColor:"#233249"},emptyIcon:{fontSize:30,color:"#20D6A0",marginBottom:10},emptyTitle:{fontSize:15,color:"#F4F7FB",fontWeight:"800"},emptyText:{fontSize:11,color:"#8796AA",lineHeight:17,textAlign:"center",marginTop:7},outlineButton:{marginTop:17,borderWidth:1,borderColor:"#20D6A0",paddingHorizontal:18,paddingVertical:10,borderRadius:10},outlineButtonText:{color:"#20D6A0",fontSize:10,fontWeight:"900"},
  progressTrack:{height:7,backgroundColor:"#26364A",borderRadius:6,marginTop:17,overflow:"hidden"},progressFill:{width:"0%",height:7,backgroundColor:"#20D6A0"},mutedSmall:{color:"#8190A5",fontSize:10,marginTop:7},
  backButton:{alignSelf:"flex-start",paddingVertical:8,paddingHorizontal:12,backgroundColor:"#17263A",borderRadius:10,marginBottom:12},backButtonText:{color:"#20D6A0",fontSize:11,fontWeight:"900"},settingRow:{flexDirection:"row",alignItems:"center",backgroundColor:"#111C2C",padding:14,borderRadius:14,marginTop:9,borderWidth:1,borderColor:"#202F43"},row:{flexDirection:"row",alignItems:"center",backgroundColor:"#111C2C",padding:13,borderRadius:14,marginTop:9,borderWidth:1,borderColor:"#202F43"},rowIcon:{width:34,height:34,borderRadius:11,backgroundColor:"#1B2C40",alignItems:"center",justifyContent:"center",marginRight:11},rowIconText:{color:"#20D6A0",fontSize:16,fontWeight:"800"},rowTitle:{color:"#F0F4F9",fontSize:12,fontWeight:"800"},rowDetail:{color:"#8291A6",fontSize:10,marginTop:3},chevron:{color:"#71829A",fontSize:23,marginLeft:8},
  customerCallButton:{marginTop:10,backgroundColor:"#20D6A0",paddingVertical:13,paddingHorizontal:16,borderRadius:12,alignItems:"center"},customerCallButtonDisabled:{opacity:.45},customerCallButtonText:{color:"#06251B",fontSize:11,fontWeight:"900",letterSpacing:.4},
  balanceCard:{backgroundColor:"#10372E",borderRadius:16,padding:17,borderWidth:1,borderColor:"#1A654F"},balanceCaption:{color:"#A2CDBF",fontSize:9,fontWeight:"900",letterSpacing:1.2},balanceValue:{color:"#FFFFFF",fontSize:29,fontWeight:"900",marginTop:8},balanceFoot:{color:"#A2CDBF",fontSize:10,marginTop:5},
  profileCard:{alignItems:"center",backgroundColor:"#121E2F",padding:20,borderRadius:18,borderWidth:1,borderColor:"#24344A",marginBottom:7},profileMetrics:{flexDirection:"row",alignItems:"center",alignSelf:"stretch",marginTop:18,paddingTop:14,borderTopWidth:1,borderTopColor:"#2A394D"},profileMetric:{flex:1,alignItems:"center"},profileMetricValue:{color:"#20D6A0",fontSize:18,fontWeight:"900"},profileMetricLabel:{color:"#8291A7",fontSize:8,fontWeight:"800",marginTop:5,textAlign:"center"},profileMetricDivider:{width:1,height:30,backgroundColor:"#2A394D"},bigAvatar:{width:66,height:66,borderRadius:23,backgroundColor:"#1A3445",borderWidth:1,borderColor:"#20D6A0",alignItems:"center",justifyContent:"center"},bigAvatarText:{color:"#20D6A0",fontSize:29,fontWeight:"900"},profileName:{color:"#F5F8FC",fontSize:16,fontWeight:"900",marginTop:10},profileStatus:{color:"#8392A7",fontSize:10,marginTop:4},
  tabBar:{height:78,backgroundColor:"#FFFFFF",borderTopWidth:1,borderTopColor:"#EEEEEE",flexDirection:"row",justifyContent:"space-around",alignItems:"center",paddingBottom:17},tabItem:{flex:1,alignItems:"center",justifyContent:"center",height:"100%",gap:5,transform:[{translateY:-10}]},tabCenter:{transform:[{translateY:-19}]},tabCenterIcon:{width:62,height:62,borderRadius:21,backgroundColor:"#20D6A0",alignItems:"center",justifyContent:"center",marginBottom:-1,elevation:10},tabIcon:{fontSize:26,color:"#B8B8B8"},tabLabel:{fontSize:10,color:"#AAAAAA",fontWeight:"700"},tabActive:{color:"#111111"},tabIndicator:{position:"absolute",top:0,width:30,height:3,backgroundColor:"#20D6A0",borderRadius:2}
});