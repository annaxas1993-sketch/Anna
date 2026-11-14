import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

const VANADZOR = { latitude: 40.8128, longitude: 44.4883 };

export default function App() {
  const [online, setOnline] = useState(false);
  const [location, setLocation] = useState(VANADZOR);
  const [permission, setPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      setPermission(true);
      const current = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    })().catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>AXAS <Text style={styles.brandAccent}>DRIVER</Text></Text>
          <Text style={styles.sub}>Վարորդի կառավարման վահանակ</Text>
        </View>
        <View style={[styles.status, online ? styles.statusOn : styles.statusOff]}>
          <View style={[styles.dot, online && styles.dotOn]} />
          <Text style={styles.statusText}>{online ? "Առցանց" : "Անցանց"}</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <MapView style={styles.map} region={{ ...location, latitudeDelta: 0.035, longitudeDelta: 0.035 }}>
          <Marker coordinate={location} title="Իմ դիրքը" description="AXAS Driver" pinColor="#25D695" />
        </MapView>
        <View style={styles.mapLabel}><Text style={styles.mapLabelText}>ՎԱՆԱՁՈՐ • ՔԱՐՏԵԶ</Text></View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.section}>Վարորդի կարգավիճակ</Text>
        <Text style={styles.helper}>{permission ? "GPS-ը միացված է" : "Տեղադրությունը հասանելի կլինի թույլտվությունից հետո"}</Text>
        <TouchableOpacity style={[styles.onlineButton, online && styles.offlineButton]} onPress={() => setOnline(!online)}>
          <Text style={styles.onlineButtonText}>{online ? "ԴԱՌՆԱԼ ԱՆՑԱՆՑ" : "ԴԱՌՆԱԼ ԱՌՑԱՆՑ"}</Text>
        </TouchableOpacity>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statNum}>0</Text><Text style={styles.statLabel}>Նոր պատվերներ</Text></View>
          <View style={styles.statLine} />
          <View style={styles.stat}><Text style={styles.statNum}>0 ֏</Text><Text style={styles.statLabel}>Այսօրվա եկամուտ</Text></View>
          <View style={styles.statLine} />
          <View style={styles.stat}><Text style={styles.statNum}>0</Text><Text style={styles.statLabel}>Ուղևորություններ</Text></View>
        </View>
      </View>
      <View style={styles.bottom}><Text style={styles.bottomText}>AXAS DRIVER  •  ՆԱԽՆԱԿԱՆ ՏԱՐԲԵՐԱԿ</Text></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#090F1B"},
  header:{paddingHorizontal:20,paddingTop:18,paddingBottom:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  brand:{color:"#FFFFFF",fontSize:23,fontWeight:"900",letterSpacing:1.4},
  brandAccent:{color:"#27D89A"},
  sub:{color:"#8794A8",fontSize:12,marginTop:4},
  status:{flexDirection:"row",alignItems:"center",gap:7,borderRadius:20,paddingHorizontal:12,paddingVertical:8},
  statusOn:{backgroundColor:"#103A31"},statusOff:{backgroundColor:"#252D3B"},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:"#9AA5B5"},dotOn:{backgroundColor:"#27D89A"},
  statusText:{color:"#EAF2F7",fontWeight:"700",fontSize:12},
  mapWrap:{flex:1,marginHorizontal:14,borderRadius:22,overflow:"hidden",borderWidth:1,borderColor:"#253247",minHeight:260},
  map:{flex:1},
  mapLabel:{position:"absolute",top:14,left:14,backgroundColor:"#101A2BEA",paddingHorizontal:12,paddingVertical:8,borderRadius:10},
  mapLabelText:{color:"#EAF4F7",fontSize:10,fontWeight:"800",letterSpacing:1},
  panel:{margin:14,marginTop:16,backgroundColor:"#121C2C",borderRadius:22,padding:18,borderWidth:1,borderColor:"#26354A"},
  section:{color:"#F4F7FB",fontSize:17,fontWeight:"800"},
  helper:{color:"#91A0B5",fontSize:12,marginTop:6,marginBottom:16},
  onlineButton:{backgroundColor:"#20C98E",borderRadius:14,paddingVertical:16,alignItems:"center"},
  offlineButton:{backgroundColor:"#344256"},
  onlineButtonText:{color:"#06150F",fontSize:13,fontWeight:"900",letterSpacing:1},
  stats:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:20},
  stat:{flex:1,alignItems:"center"},
  statNum:{color:"#FFFFFF",fontSize:18,fontWeight:"900"},
  statLabel:{color:"#8D9AAF",fontSize:10,marginTop:5,textAlign:"center"},
  statLine:{width:1,height:30,backgroundColor:"#2B394D"},
  bottom:{alignItems:"center",paddingBottom:10},
  bottomText:{color:"#56657B",fontSize:9,letterSpacing:1.2,fontWeight:"700"}
});
