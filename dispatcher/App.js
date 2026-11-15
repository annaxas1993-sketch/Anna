import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator, Alert, BackHandler, Keyboard, SafeAreaView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {WebView} from 'react-native-webview';

const KEY = 'taxi_lider_dispatcher_server_url';
const DEFAULT_URL = 'https://taxi-lider-api.onrender.com/';

function normalize(value) {
  let v = String(value || '').trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  return v.replace(/\/+$/, '') + '/';
}

export default function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [draft, setDraft] = useState(DEFAULT_URL);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webKey, setWebKey] = useState(0);
  const [error, setError] = useState(false);

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
      setError(false);
      setLoading(true);
      setWebKey(k => k + 1);
      Keyboard.dismiss();
    } catch {
      Alert.alert('Սխալ', 'Չհաջողվեց պահպանել սերվերի հասցեն։');
    }
  }

  if (!ready) return <View style={styles.center}><ActivityIndicator size="large" color="#4d88f5" /></View>;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>TAXI <Text style={styles.blue}>LIDER</Text></Text>
          <Text style={styles.caption}>ԴԻՍՊԵՏՉԵՐԻ ՎԱՀԱՆԱԿ</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.settingsButton}
          onPress={() => {setDraft(url); setShowSettings(v => !v);}}
        >
          <Text style={styles.settingsText}>ՍԵՐՎԵՐ ⚙</Text>
        </TouchableOpacity>
      </View>

      {showSettings ? (
        <View style={styles.settings}>
          <Text style={styles.heading}>Սերվերի հասցե</Text>
          <Text style={styles.help}>Հավելվածը միանում է TAXI LIDER դիսպետչերի վահանակին։ Սերվերի հասցեն փոխիր միայն անհրաժեշտության դեպքում։</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://server.example.com"
            placeholderTextColor="#8792a4"
            style={styles.input}
          />
          <TouchableOpacity style={styles.connect} onPress={connect}>
            <Text style={styles.connectText}>ՊԱՀՊԱՆԵԼ ԵՎ ՄԻԱՆԱԼ</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.webWrap}>
          <WebView
            key={webKey}
            source={{uri: url}}
            style={styles.web}
            originWhitelist={['http://*', 'https://*']}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            cacheEnabled
            onLoadStart={() => {setLoading(true); setError(false);}}
            onLoadEnd={() => setLoading(false)}
            onError={() => {setLoading(false); setError(true);}}
            onHttpError={event => {
              if (event.nativeEvent.statusCode >= 500) setError(true);
            }}
            startInLoadingState
            pullToRefreshEnabled
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
            renderLoading={() => <View style={styles.webLoading}><ActivityIndicator size="large" color="#4d88f5" /><Text style={styles.loadingText}>Բացվում է դիսպետչերի վահանակը…</Text></View>}
          />
          {loading && <View pointerEvents="none" style={styles.loadingBadge}><ActivityIndicator size="small" color="#4d88f5" /></View>}
          {error && (
            <View style={styles.errorPanel}>
              <Text style={styles.errorTitle}>Սերվերի հետ կապ չկա</Text>
              <Text style={styles.help}>Ստուգիր ինտերնետը կամ սերվերի աշխատանքը։ Կարող ես կրկին փորձել։</Text>
              <TouchableOpacity style={styles.connect} onPress={() => {setError(false);setLoading(true);setWebKey(k => k + 1);}}>
                <Text style={styles.connectText}>ԿՐԿԻՆ ՓՈՐՁԵԼ</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#f3f5fa'},
  header:{height:58,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e1e5ed',paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brand:{color:'#202634',fontSize:19,fontWeight:'900'},
  blue:{color:'#397df2'},
  caption:{color:'#778091',fontSize:9,fontWeight:'800',letterSpacing:1.5},
  settingsButton:{backgroundColor:'#edf1f8',paddingHorizontal:12,paddingVertical:9,borderRadius:10},
  settingsText:{color:'#30394a',fontSize:11,fontWeight:'800'},
  webWrap:{flex:1,position:'relative'},
  web:{flex:1,backgroundColor:'#f3f5fa'},
  center:{flex:1,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  webLoading:{flex:1,backgroundColor:'#f3f5fa',alignItems:'center',justifyContent:'center',gap:12},
  loadingText:{color:'#697282',fontSize:13,fontWeight:'600'},
  loadingBadge:{position:'absolute',top:10,right:12,backgroundColor:'#fff',padding:8,borderRadius:20,elevation:2},
  settings:{flex:1,padding:20,justifyContent:'center',backgroundColor:'#f3f5fa'},
  heading:{fontSize:23,fontWeight:'900',color:'#202634',marginBottom:12},
  help:{fontSize:14,color:'#778091',lineHeight:22,marginBottom:18},
  input:{backgroundColor:'#fff',borderColor:'#dfe4ed',borderWidth:1,borderRadius:11,color:'#202634',padding:14,fontSize:15},
  connect:{marginTop:14,backgroundColor:'#4d88f5',padding:15,borderRadius:11,alignItems:'center'},
  connectText:{color:'#fff',fontWeight:'900'},
  errorPanel:{position:'absolute',left:20,right:20,top:'28%',backgroundColor:'#fff',borderRadius:18,padding:20,elevation:5,borderWidth:1,borderColor:'#e1e5ed'},
  errorTitle:{fontSize:19,fontWeight:'900',color:'#202634',marginBottom:8}
});
