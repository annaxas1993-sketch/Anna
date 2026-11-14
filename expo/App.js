import React, { useEffect, useRef, useState } from "react";
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import * as Location from "expo-location";

const DEFAULT_LOCATION = { latitude: 40.8128, longitude: 44.4883 };
const TABS = [
  { id: "home", icon: "⌂", label: "Գլխավոր" },
  { id: "orders", icon: "▣", label: "Պատվերներ" },
  { id: "tasks", icon: "✓", label: "Առաջադրանք" },
  { id: "balance", icon: "₽", label: "Հաշվեկշիռ" },
  { id: "profile", icon: "●", label: "Պրոֆիլ" },
];

function Metric({ value, label }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function Row({ title, detail, icon = "›", onPress }) {
  return <TouchableOpacity style={styles.row} onPress={onPress || (() => Alert.alert(title, "Այս բաժինը կմիանա սերվերին հաջորդ փուլում։"))}>
    <View style={styles.rowIcon}><Text style={styles.rowIconText}>{icon}</Text></View>
    <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text>{detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}</View>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>;
}

export default function App() {
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState("home");
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [gpsReady, setGpsReady] = useState(false);
  const mapRef = useRef(null);
  const destination = { latitude: location.latitude + 0.0065, longitude: location.longitude + 0.0075 };
  const zoomMap = (factor) => mapRef.current?.animateToRegion({ ...location, latitudeDelta: Math.max(0.003, Math.min(0.08, 0.025 * factor)), longitudeDelta: Math.max(0.003, Math.min(0.08, 0.025 * factor)) }, 250);

  useEffect(() => {
    let active = true;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return;
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (active) {
        const next = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setLocation(next);
        setGpsReady(true);
        mapRef.current?.animateToRegion({ ...next, latitudeDelta: 0.018, longitudeDelta: 0.018 }, 500);
      }
    })().catch(() => {});
    return () => { active = false; };
  }, []);

  const toggleOnline = () => {
    setOnline(v => !v);
    if (!online) Alert.alert("Առցանց ռեժիմ", "Դիզայնի ցուցադրական ռեժիմ է․ իրական պատվերներ ստանալու համար պետք է միացնել սերվերը։");
  };

  const renderHome = () => <>
    <View style={styles.welcomeLine}>
      <View><Text style={styles.eyebrow}>ԲԱՐԻ ԳԱԼՈՒՍՏ, ՎԱՐՈՐԴ</Text><Text style={styles.pageTitle}>Քո աշխատանքային օրը</Text></View>
      <View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View>
    </View>
    <View style={styles.statusCard}>
      <View style={{flex:1}}>
        <View style={styles.statusLabelLine}><View style={[styles.statusDot, online && styles.statusDotOn]} /><Text style={styles.statusLabel}>{online ? "ԴՈՒ ԱՌՑԱՆՑ ԵՍ" : "ԴՈՒ ԱՆՑԱՆՑ ԵՍ"}</Text></View>
        <Text style={styles.statusHeadline}>{online ? "Պատրաստ ես պատվերների" : "Սկսի՛ր աշխատանքը"}</Text>
        <Text style={styles.statusHint}>{gpsReady ? "GPS-ը միացված է" : "Սպասում ենք GPS դիրքին"}</Text>
      </View>
      <TouchableOpacity onPress={toggleOnline} style={[styles.goButton, online && styles.stopButton]}><Text style={styles.goButtonText}>{online ? "ԱՆՑԱՆՑ" : "ՍԿՍԵԼ"}</Text></TouchableOpacity>
    </View>
    <View style={styles.metricsCard}>
      <Metric value="0 ֏" label="Այսօրվա եկամուտ" /><View style={styles.metricDivider}/><Metric value="0" label="Պատվերներ"/><View style={styles.metricDivider}/><Metric value="0" label="Ուղևորություններ"/>
    </View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>ՔԱՐՏԵԶ ԵՎ ԴԻՐՔ</Text><Text style={styles.liveTag}>● GPS</Text></View>
    <View style={styles.mapCard}>
      <MapView ref={mapRef} style={styles.map} initialRegion={{...location, latitudeDelta:0.025, longitudeDelta:0.025}} showsUserLocation={false} showsMyLocationButton={false} showsCompass showsScale showsBuildings mapType="none" toolbarEnabled zoomEnabled>
        <UrlTile urlTemplate="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maximumZ={20} tileSize={256} />
        <Polyline coordinates={[location, destination]} strokeColor="#20D6A0" strokeWidth={5} lineDashPattern={[0]}/>
        <Marker coordinate={location} title="A • Իմ դիրքը" description="AXAS Driver">
          <View style={styles.driverMarker}><View style={styles.driverArrow}/></View>
        </Marker>
        <Marker coordinate={destination} title="B • Ուղղություն" description="Օրինակային կետ" pinColor="#F5A623"/>
      </MapView>
      <View style={styles.mapPill}><Text style={styles.mapPillText}>AXAS • LIVE MAP</Text></View>
      <View style={styles.routePill}><Text style={styles.routePillText}>A</Text><View style={styles.routeDash}/><Text style={styles.routePillText}>B</Text><Text style={styles.routeCaption}>Օրինակային ուղղություն</Text></View>
      <View style={styles.mapControls}><TouchableOpacity style={styles.mapControl} onPress={() => zoomMap(0.55)}><Text style={styles.mapControlText}>+</Text></TouchableOpacity><TouchableOpacity style={styles.mapControl} onPress={() => zoomMap(1.8)}><Text style={styles.mapControlText}>−</Text></TouchableOpacity><TouchableOpacity style={styles.mapControl} onPress={() => mapRef.current?.animateToRegion({...location, latitudeDelta:0.025, longitudeDelta:0.025},300)}><Text style={styles.mapControlText}>◎</Text></TouchableOpacity></View>
    </View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>ԱՇԽԱՏԱՆՔԱՅԻՆ ԿԱՐԳԱՎԻՃԱԿ</Text></View>
    <View style={styles.infoCard}><Text style={styles.infoTitle}>{online ? "Սպասում ենք նոր պատվերի" : "Միացրու առցանց ռեժիմը"}</Text><Text style={styles.infoText}>{online ? "Նոր պատվերները կհայտնվեն Պատվերներ բաժնում, երբ սերվերը միացված լինի։" : "Առցանց դառնալուց հետո կարող ես ստանալ ուղևորությունների առաջարկներ։"}</Text></View>
  </>;

  const renderOrders = () => <><Text style={styles.pageTitle}>Պատվերներ</Text><Text style={styles.pageSubtitle}>Նոր առաջարկներ և ընթացիկ ուղևորություններ</Text><View style={styles.emptyCard}><Text style={styles.emptyIcon}>▣</Text><Text style={styles.emptyTitle}>Դեռ պատվերներ չկան</Text><Text style={styles.emptyText}>Երբ սերվերը միացված լինի, այստեղ կհայտնվեն հասանելի պատվերները։</Text><TouchableOpacity style={styles.outlineButton} onPress={() => setTab("home")}><Text style={styles.outlineButtonText}>ԳԼԽԱՎՈՐ ԷՋ</Text></TouchableOpacity></View></>;
  const renderTasks = () => <><Text style={styles.pageTitle}>Առաջադրանքներ</Text><Text style={styles.pageSubtitle}>Բոնուսներ և օրվա նպատակներ</Text><View style={styles.infoCard}><Text style={styles.infoTitle}>Օրվա նպատակ</Text><Text style={styles.infoText}>Առաջադրանքները և բոնուսները կցուցադրվեն այստեղ՝ սերվերի միացումից հետո։</Text><View style={styles.progressTrack}><View style={styles.progressFill}/></View><Text style={styles.mutedSmall}>0 / 10 ուղևորություն</Text></View><Row title="Շաբաթական բոնուս" detail="Առաջընթացը դեռ հասանելի չէ" icon="★"/><Row title="Ակտիվության միավորներ" detail="Կհաշվարկվեն ուղևորություններից" icon="↗"/></>;
  const renderBalance = () => <><Text style={styles.pageTitle}>Հաշվեկշիռ</Text><Text style={styles.pageSubtitle}>Եկամուտներ և վճարումների պատմություն</Text><View style={styles.balanceCard}><Text style={styles.balanceCaption}>ԸՆԴՀԱՆՈՒՐ ՀԱՇՎԵԿՇԻՌ</Text><Text style={styles.balanceValue}>0 ֏</Text><Text style={styles.balanceFoot}>Ցուցադրական տվյալներ</Text></View><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>ԳՈՐԾԱՐՔՆԵՐ</Text></View><View style={styles.emptyCard}><Text style={styles.emptyTitle}>Գործարքներ դեռ չկան</Text><Text style={styles.emptyText}>Ուղևորությունների վճարումները կերևան այստեղ։</Text></View></>;
  const renderProfile = () => <><Text style={styles.pageTitle}>Իմ պրոֆիլը</Text><Text style={styles.pageSubtitle}>Վարորդի տվյալներ և կարգավորումներ</Text><View style={styles.profileCard}><View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>A</Text></View><Text style={styles.profileName}>AXAS վարորդ</Text><Text style={styles.profileStatus}>Նոր հաշիվ • Տվյալները լրացված չեն</Text></View><Row title="Անձնական տվյալներ" detail="Անուն, հեռախոս և լուսանկար" icon="●"/><Row title="Մեքենայի տվյալներ" detail="Մակնիշ, համարանիշ և գույն" icon="▰"/><Row title="Փաստաթղթեր" detail="Վարորդական իրավունք և գրանցում" icon="▤"/><Row title="Սակագներ" detail="Ծառայության տեսակներ" icon="₽"/><Row title="Կարգավորումներ" detail="Ծանուցումներ և հավելված" icon="⚙"/><Row title="Օգնություն և աջակցություն" detail="Կապ օպերատորի հետ" icon="?"/> </>;

  const screens = {home:renderHome, orders:renderOrders, tasks:renderTasks, balance:renderBalance, profile:renderProfile};
  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content" backgroundColor="#080E19"/>
    {tab === "home" ? <View style={styles.fullMap}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} initialRegion={{...location, latitudeDelta:0.018, longitudeDelta:0.018}} showsUserLocation showsMyLocationButton={false} showsCompass={false} showsScale={false} showsBuildings mapType="standard" toolbarEnabled zoomEnabled>
        <Marker coordinate={location} title="Իմ դիրքը" description="AXAS Driver">
          <View style={styles.driverMarker}><View style={styles.driverArrow}/></View>
        </Marker>
      </MapView>
      <View style={styles.mapTopOverlay}>
        <View style={styles.mapBrand}><Text style={styles.brand}>AXAS <Text style={styles.brandAccent}>DRIVER</Text></Text><Text style={styles.mapGps}>{gpsReady ? "GPS • ԱԿՏԻՎ" : "GPS • ՍՊԱՍՈՒՄ"}</Text></View>
        <TouchableOpacity onPress={toggleOnline} style={[styles.mapOnlineButton, online && styles.mapOnlineButtonOn]}><View style={[styles.tinyDot, online && styles.statusDotOn]}/><Text style={styles.mapOnlineText}>{online ? "ԱՌՑԱՆՑ" : "ԱՆՑԱՆՑ"}</Text></TouchableOpacity>
      </View>
      <View style={styles.mapAttribution}><Text style={styles.mapAttributionText}>© OpenStreetMap • © CARTO</Text></View>
      <View style={styles.mapControlsFull}>
        <TouchableOpacity style={styles.mapControl} onPress={() => zoomMap(0.55)}><Text style={styles.mapControlText}>+</Text></TouchableOpacity>
        <TouchableOpacity style={styles.mapControl} onPress={() => zoomMap(1.8)}><Text style={styles.mapControlText}>−</Text></TouchableOpacity>
        <TouchableOpacity style={styles.mapControl} onPress={() => mapRef.current?.animateToRegion({...location, latitudeDelta:0.018, longitudeDelta:0.018},300)}><Text style={styles.mapControlText}>◎</Text></TouchableOpacity>
      </View>
    </View> : <>
      <View style={styles.topBar}><Text style={styles.brand}>AXAS <Text style={styles.brandAccent}>DRIVER</Text></Text><View style={[styles.topStatus, online && styles.topStatusOn]}><View style={[styles.tinyDot, online && styles.statusDotOn]}/><Text style={styles.topStatusText}>{online ? "Առցանց" : "Անցանց"}</Text></View></View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{screens[tab]()}</ScrollView>
    </>}
    <View style={styles.tabBar}>{TABS.map(item => <TouchableOpacity key={item.id} style={[styles.tabItem, item.id==="tasks" && styles.tabCenter]} onPress={() => setTab(item.id)}>{item.id==="tasks" ? <View style={styles.tabCenterIcon}><Text style={{fontSize:22,color:"#061810",fontWeight:"900"}}>{item.icon}</Text></View> : <Text style={[styles.tabIcon, tab===item.id && styles.tabActive]}>{item.icon}</Text>}<Text style={[styles.tabLabel, tab===item.id && styles.tabActive]}>{item.label}</Text>{tab===item.id && <View style={styles.tabIndicator}/>}</TouchableOpacity>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#080E19"},
  fullMap:{flex:1,backgroundColor:"#101A29"},
  mapTopOverlay:{position:"absolute",top:10,left:12,right:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  mapBrand:{backgroundColor:"#091321E8",paddingHorizontal:13,paddingVertical:9,borderRadius:13,borderWidth:1,borderColor:"#26364B"},
  mapGps:{color:"#20D6A0",fontSize:8,fontWeight:"900",letterSpacing:1,marginTop:3},
  mapOnlineButton:{flexDirection:"row",alignItems:"center",gap:7,backgroundColor:"#101D2DEB",paddingHorizontal:14,paddingVertical:12,borderRadius:13,borderWidth:1,borderColor:"#39485C"},
  mapOnlineButtonOn:{backgroundColor:"#10372E",borderColor:"#20D6A0"},
  mapOnlineText:{color:"#FFFFFF",fontSize:10,fontWeight:"900",letterSpacing:.8},
  mapAttribution:{position:"absolute",left:9,bottom:8,backgroundColor:"#091321D9",paddingHorizontal:7,paddingVertical:4,borderRadius:5},
  mapAttributionText:{color:"#C5CFDA",fontSize:8},
  mapControlsFull:{position:"absolute",right:12,bottom:18,gap:8},
  topBar:{height:58,paddingHorizontal:19,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#182438"},
  brand:{fontSize:20,fontWeight:"900",letterSpacing:1.2,color:"#F5F8FC"},brandAccent:{color:"#20D6A0"},
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
  mapCard:{height:315,borderRadius:18,overflow:"hidden",borderWidth:1,borderColor:"#26364B"},map:{flex:1},driverMarker:{width:30,height:30,borderRadius:15,backgroundColor:"#20D6A0",borderWidth:3,borderColor:"#FFFFFF",alignItems:"center",justifyContent:"center",elevation:8},driverArrow:{width:0,height:0,borderLeftWidth:5,borderRightWidth:5,borderBottomWidth:11,borderLeftColor:"transparent",borderRightColor:"transparent",borderBottomColor:"#06251B"},routePill:{position:"absolute",left:11,bottom:11,flexDirection:"row",alignItems:"center",backgroundColor:"#0C1728E8",paddingHorizontal:10,paddingVertical:8,borderRadius:10,gap:7},routePillText:{color:"#20D6A0",fontSize:11,fontWeight:"900"},routeDash:{width:18,height:2,backgroundColor:"#20D6A0"},routeCaption:{color:"#EAF4F7",fontSize:9,fontWeight:"700"},mapControls:{position:"absolute",right:10,bottom:10,gap:7},mapControl:{width:38,height:38,borderRadius:12,backgroundColor:"#0C1728F0",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#40536B"},mapControlText:{color:"#FFFFFF",fontSize:21,fontWeight:"800"},mapPill:{position:"absolute",top:11,left:11,backgroundColor:"#0C1728E8",paddingHorizontal:10,paddingVertical:7,borderRadius:8},mapPillText:{fontSize:9,color:"#EAF4F7",fontWeight:"900",letterSpacing:.8},
  infoCard:{backgroundColor:"#121E2F",borderRadius:16,padding:16,borderWidth:1,borderColor:"#24344A"},infoTitle:{color:"#F4F7FB",fontSize:14,fontWeight:"800"},infoText:{color:"#8D9CB0",fontSize:11,lineHeight:17,marginTop:7},
  emptyCard:{marginTop:12,backgroundColor:"#111C2C",borderRadius:18,padding:23,alignItems:"center",borderWidth:1,borderColor:"#233249"},emptyIcon:{fontSize:30,color:"#20D6A0",marginBottom:10},emptyTitle:{fontSize:15,color:"#F4F7FB",fontWeight:"800"},emptyText:{fontSize:11,color:"#8796AA",lineHeight:17,textAlign:"center",marginTop:7},outlineButton:{marginTop:17,borderWidth:1,borderColor:"#20D6A0",paddingHorizontal:18,paddingVertical:10,borderRadius:10},outlineButtonText:{color:"#20D6A0",fontSize:10,fontWeight:"900"},
  progressTrack:{height:7,backgroundColor:"#26364A",borderRadius:6,marginTop:17,overflow:"hidden"},progressFill:{width:"0%",height:7,backgroundColor:"#20D6A0"},mutedSmall:{color:"#8190A5",fontSize:10,marginTop:7},
  row:{flexDirection:"row",alignItems:"center",backgroundColor:"#111C2C",padding:13,borderRadius:14,marginTop:9,borderWidth:1,borderColor:"#202F43"},rowIcon:{width:34,height:34,borderRadius:11,backgroundColor:"#1B2C40",alignItems:"center",justifyContent:"center",marginRight:11},rowIconText:{color:"#20D6A0",fontSize:16,fontWeight:"800"},rowTitle:{color:"#F0F4F9",fontSize:12,fontWeight:"800"},rowDetail:{color:"#8291A6",fontSize:10,marginTop:3},chevron:{color:"#71829A",fontSize:23,marginLeft:8},
  balanceCard:{backgroundColor:"#10372E",borderRadius:18,padding:20,borderWidth:1,borderColor:"#1A654F"},balanceCaption:{color:"#A2CDBF",fontSize:9,fontWeight:"900",letterSpacing:1.2},balanceValue:{color:"#FFFFFF",fontSize:32,fontWeight:"900",marginTop:8},balanceFoot:{color:"#A2CDBF",fontSize:10,marginTop:5},
  profileCard:{alignItems:"center",backgroundColor:"#121E2F",padding:20,borderRadius:18,borderWidth:1,borderColor:"#24344A",marginBottom:7},bigAvatar:{width:66,height:66,borderRadius:23,backgroundColor:"#1A3445",borderWidth:1,borderColor:"#20D6A0",alignItems:"center",justifyContent:"center"},bigAvatarText:{color:"#20D6A0",fontSize:29,fontWeight:"900"},profileName:{color:"#F5F8FC",fontSize:16,fontWeight:"900",marginTop:10},profileStatus:{color:"#8392A7",fontSize:10,marginTop:4},
  tabBar:{height:76,backgroundColor:"#080E19",borderTopWidth:1,borderTopColor:"#1C2A3E",flexDirection:"row",justifyContent:"space-around",alignItems:"center",paddingBottom:4},tabItem:{flex:1,alignItems:"center",justifyContent:"center",height:"100%",gap:3},tabCenter:{transform:[{translateY:-9}]},tabCenterIcon:{width:48,height:48,borderRadius:17,backgroundColor:"#20D6A0",alignItems:"center",justifyContent:"center",marginBottom:-1,elevation:9},tabIcon:{fontSize:18,color:"#718198"},tabLabel:{fontSize:8,color:"#718198",fontWeight:"700"},tabActive:{color:"#20D6A0"},tabIndicator:{position:"absolute",top:0,width:24,height:2,backgroundColor:"#20D6A0",borderRadius:2}
});