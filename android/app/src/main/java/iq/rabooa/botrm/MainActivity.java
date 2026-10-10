package iq.rabooa.botrm;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;

/** غلاف WebView يفتح منصة Bot Rm بملء الشاشة، مع دعم رفع الملفات ومشاركة الصور/PDF. */
public class MainActivity extends Activity {
    private static final String HOME = "https://bot-rm-app.pages.dev/";
    private static final String HOST = "bot-rm-app.pages.dev";
    private static final int PICK = 1001;

    private WebView web;
    private ValueCallback<Uri[]> chooser;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " BotRmApp/1");

        web.addJavascriptInterface(new Bridge(), "BotRmApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) {
                    v.loadData("<html dir='rtl'><body style='font-family:sans-serif;text-align:center;padding:60px 24px;background:#06222b;color:#eef8fa'>"
                            + "<h2>تعذّر الاتصال</h2><p>تأكد من الإنترنت ثم أعد المحاولة.</p>"
                            + "<button style='font-size:18px;padding:12px 28px;border:0;border-radius:12px;background:#3cc3df' onclick=\"location.href='" + HOME + "'\">إعادة المحاولة</button>"
                            + "</body></html>", "text/html; charset=utf-8", "utf-8");
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = cb;
                try { startActivityForResult(p.createIntent(), PICK); }
                catch (Exception e) { chooser = null; return false; }
                return true;
            }
        });

        if (b == null) web.loadUrl(HOME); else web.restoreState(b);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK && chooser != null) {
            chooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            chooser = null;
        } else super.onActivityResult(req, res, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onDestroy() { web.destroy(); super.onDestroy(); }

    /** جسر JavaScript: يستقبل ملفات (Base64) من الصفحة ويفتح قائمة المشاركة (واتساب، حفظ، ...). */
    private class Bridge {
        @JavascriptInterface
        public boolean isApp() { return true; }

        /** json: [{"b64":"...","name":"x.png","mime":"image/png"}], text اختياري */
        @JavascriptInterface
        public void shareFiles(String json, String text) {
            try {
                JSONArray arr = new JSONArray(json);
                File dir = new File(getCacheDir(), "shared");
                //noinspection ResultOfMethodCallIgnored
                dir.mkdirs();
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) //noinspection ResultOfMethodCallIgnored
                    f.delete();
                ArrayList<Uri> uris = new ArrayList<>();
                String mime = "*/*";
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    String name = o.getString("name").replaceAll("[^\\p{L}\\p{N}._-]", "_");
                    File f = new File(dir, name);
                    try (FileOutputStream fo = new FileOutputStream(f)) { fo.write(Base64.decode(o.getString("b64"), Base64.DEFAULT)); }
                    uris.add(FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", f));
                    mime = o.optString("mime", "*/*");
                }
                Intent it = new Intent(uris.size() > 1 ? Intent.ACTION_SEND_MULTIPLE : Intent.ACTION_SEND);
                it.setType(mime);
                if (uris.size() > 1) it.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                else it.putExtra(Intent.EXTRA_STREAM, uris.get(0));
                if (text != null && !text.isEmpty()) it.putExtra(Intent.EXTRA_TEXT, text);
                it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(Intent.createChooser(it, "مشاركة")));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تعذّرت المشاركة", Toast.LENGTH_SHORT).show());
            }
        }
    }
}
