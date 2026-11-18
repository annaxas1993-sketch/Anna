package am.axas.driver;

import android.Manifest;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import android.content.pm.PackageManager;
import android.os.Build;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView web;
    private GeolocationPermissions.Callback geo;
    private String origin;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadsImagesAutomatically(true);
        if (Build.VERSION.SDK_INT >= 21) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String requestOrigin, GeolocationPermissions.Callback callback) {
                origin = requestOrigin;
                geo = callback;
                if (Build.VERSION.SDK_INT >= 23 &&
                    checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 41);
                } else {
                    callback.invoke(requestOrigin, true, false);
                    geo = null;
                }
            }
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                android.util.Log.d("TAXI_LIDER_WEB", message.message() + " (" + message.lineNumber() + ")");
                return true;
            }
        });
        try {
            InputStream input = getAssets().open("index.html");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            input.close();
            String html = output.toString("UTF-8");
            // A secure HTTPS origin is required by Android WebView geolocation.
            web.loadDataWithBaseURL("https://appassets.androidplatform.net/assets/index.html",
                html, "text/html", "UTF-8", null);
        } catch (Exception error) {
            android.util.Log.e("TAXI_LIDER", "Could not load driver interface", error);
            web.loadData("<h3>TAXI LIDER</h3><p>Հավելվածի էջը չի բացվում։</p>",
                "text/html", "UTF-8");
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == 41 && geo != null) {
            boolean granted = false;
            for (int result : results) if (result == PackageManager.PERMISSION_GRANTED) granted = true;
            geo.invoke(origin, granted, false);
            geo = null;
        }
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}