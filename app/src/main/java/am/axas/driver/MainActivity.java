package am.axas.driver;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.os.Bundle;
import android.webkit.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;

public class MainActivity extends Activity {
    private WebView web;
    private GeolocationPermissions.Callback geo;
    private String origin;
    private long downloadId=-1;
    private DownloadManager dm;
    private BroadcastReceiver downloadReceiver;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        dm=(DownloadManager)getSystemService(Context.DOWNLOAD_SERVICE);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadsImagesAutomatically(true);
        if (Build.VERSION.SDK_INT >= 21) settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new UpdateBridge(), "AndroidUpdater");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String requestOrigin, GeolocationPermissions.Callback callback) {
                origin=requestOrigin; geo=callback;
                if (Build.VERSION.SDK_INT >= 23 &&
                    checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 41);
                } else { callback.invoke(requestOrigin,true,false); geo=null; }
            }
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                android.util.Log.d("TAXI_LIDER_WEB",message.message()+" ("+message.lineNumber()+")"); return true;
            }
        });
        downloadReceiver=new BroadcastReceiver(){
            @Override public void onReceive(Context context,Intent intent){
                if(DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())){
                    long id=intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID,-1);
                    if(id==downloadId){Uri apkUri=dm.getUriForDownloadedFile(id); if(apkUri!=null){
                        Intent install=new Intent(Intent.ACTION_VIEW);
                        install.setDataAndType(apkUri,"application/vnd.android.package-archive");
                        install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try{startActivity(install);}catch(Exception e){android.util.Log.e("TAXI_LIDER","Installer launch failed",e);}
                    }}
                }
            }
        };
        if(Build.VERSION.SDK_INT>=33) registerReceiver(downloadReceiver,new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),RECEIVER_NOT_EXPORTED);
        else registerReceiver(downloadReceiver,new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        try {
            InputStream input=getAssets().open("index.html"); ByteArrayOutputStream output=new ByteArrayOutputStream();
            byte[] buffer=new byte[8192]; int count; while((count=input.read(buffer))!=-1)output.write(buffer,0,count); input.close();
            web.loadDataWithBaseURL("https://appassets.androidplatform.net/assets/index.html",output.toString("UTF-8"),"text/html","UTF-8",null);
        } catch(Exception error){ android.util.Log.e("TAXI_LIDER","Could not load driver interface",error); web.loadData("<h3>TAXI LIDER</h3><p>Հավելվածի էջը չի բացվում։</p>","text/html","UTF-8"); }
    }
    private class UpdateBridge {
        @JavascriptInterface public void downloadAndInstall(String url){
            runOnUiThread(()->{
                try{
                    Uri uri=Uri.parse(url);
                    DownloadManager.Request request=new DownloadManager.Request(uri);
                    request.setTitle("TAXI LIDER-ի թարմացում");
                    request.setDescription("Ներբեռնվում է նոր տարբերակը");
                    request.setMimeType("application/vnd.android.package-archive");
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalFilesDir(MainActivity.this,Environment.DIRECTORY_DOWNLOADS,"taxi-lider-update.apk");
                    downloadId=dm.enqueue(request);
                }catch(Exception e){android.util.Log.e("TAXI_LIDER","APK download failed",e);}
            });
        }
    }
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
        super.onRequestPermissionsResult(requestCode,permissions,results);
        if(requestCode==41&&geo!=null){boolean granted=false;for(int result:results)if(result==PackageManager.PERMISSION_GRANTED)granted=true;geo.invoke(origin,granted,false);geo=null;}
    }
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(downloadReceiver!=null)try{unregisterReceiver(downloadReceiver);}catch(Exception ignored){}super.onDestroy();}
}
