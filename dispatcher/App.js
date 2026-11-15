import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, BackHandler, Keyboard, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {WebView} from 'react-native-webview';

const KEY = 'taxi_lider_dispatcher_server_url';
const DEFAULT_URL = 'https://taxi-lider-api.onrender.com/';

export default function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [draft, setDraft] = useState(DEFAULT_URL);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [webKey, setWebKey] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(saved => {
      if (saved) { setUrl(normalize(saved)); setDraft(normalize(saved)); }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSettings) { setShowSettings(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showSettings]);

  function normalize(value) {
    let v = String(value || '').trim();
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    return v.replace(/\/+$/, '') + '/';
  }

  async function connect() {
    const next = normalize(draft);
    if (!/^https?:\/\/[^\s]+\/$/.test(next)) {
      Alert.alert('Սխալ հասցե', 'Մուտքագրիր սերվերի ճիշտ հասցեն։');
      return;
    }
    try {
      await AsyncStorage.setItem(KEY, next);
      setUrl(next);
      setShowSettings(false);
      setWebKey(k => k + 1);
      Keyboard.dismiss();
    } catch {
      Alert.alert('Սխալ', 'Չհաջողվեց պահպանել սերվերի հասցեն։');
    }
  }

  if (!ready) return <View style={styles.center}><ActivityIndicator size="large" color="#f4bd45" /></View>;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#081321" />
      <View style={styles.header}>
        <View><Text style={styles.brand}>TAXI <Text style={styles.gold}>LIDER</Text></Text><Text style={styles.caption}>ԴԻՍՊԵՏՉԵՐ</Text></View>
        <TouchableOpacity style={styles.settingsButton} onPress={() => {setDraft(url); setShowSettings(v => !v);}}><Text style={styles.settingsText}>ՍԵՐՎԵՐ ⚙</Text></TouchableOpacity>
      </View>
      {showSettings ? (
        <View style={styles.settings}>
          <Text style={styles.heading}>Սերվերի հասցե</Text>
          <Text style={styles.help}>Մշտական սերվերի հասցեն արդեն լրացված է։ Եթե հասցեն փոխվի, այստեղ կարող ես տեղադրել նորը։</Text>
          <TextInput value={draft} onChangeText={setDraft} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://server.example.com" placeholderTextColor="#7890a8" style={styles.input} />
          <TouchableOpacity style={styles.connect} onPress={connect}><Text style={styles.connectText}>ՊԱՀՊԱՆԵԼ ԵՎ ՄԻԱՆԱԼ</Text></TouchableOpacity>
        </View>
      ) : (
        <WebView
          key={webKey}
          source={{uri: url}}
          style={styles.web}
          originWhitelist={['http://*', 'https://*']}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {setLoading(false); Alert.alert('Կապ չկա', 'Ստուգիր սերվերի հասցեն և համոզվիր, որ TAXI LIDER սերվերը միացված է։ Սերվերի հասցեն կարող ես փոխել վերևի ՍԵՐՎԵՐ կոճակից։');}}
          renderLoading={() => <View style={styles.center}><ActivityIndicator size="large" color="#f4bd45" /></View>}
          startInLoadingState
          pullToRefreshEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
        />
      )}
      {loading && !showSettings ? <View style={styles.loading}><ActivityIndicator color="#f4bd45" /></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#081321'},
  header:{height:58,backgroundColor:'#0b1928',borderBottomWidth:1,borderBottomColor:'#263c52',paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brand:{color:'#f4f7fb',fontSize:19,fontWeight:'900'},
  gold:{color:'#f4bd45'},
  caption:{color:'#8da2b8',fontSize:9,fontWeight:'800',letterSpacing:2},
  settingsButton:{backgroundColor:'#263b50',paddingHorizontal:12,paddingVertical:9,borderRadius:9},
  settingsText:{color:'#fff',fontSize:11,fontWeight:'800'},
  web:{flex:1,backgroundColor:'#081321'},
  center:{flex:1,backgroundColor:'#081321',alignItems:'center',justifyContent:'center'},
  loading:{position:'absolute',top:64,right:12,backgroundColor:'#102238',padding:7,borderRadius:20},
  settings:{flex:1,padding:20,justifyContent:'center'},
  heading:{fontSize:23,fontWeight:'900',color:'#fff',marginBottom:12},
  help:{fontSize:14,color:'#9badc0',lineHeight:22,marginBottom:18},
  input:{backgroundColor:'#102238',borderColor:'#344c65',borderWidth:1,borderRadius:11,color:'#fff',padding:14,fontSize:15},
  connect:{marginTop:14,backgroundColor:'#f4bd45',padding:15,borderRadius:11,alignItems:'center'},
  connectText:{color:'#142235',fontWeight:'900'}
});
