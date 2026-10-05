package com.myajo.app;

import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.CookieManager;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(Color.rgb(247, 245, 240));
            this.bridge.getWebView().setFocusable(true);
            this.bridge.getWebView().setFocusableInTouchMode(true);
            this.bridge.getWebView().requestFocus(View.FOCUS_DOWN);
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(this.bridge.getWebView(), true);
            cookieManager.flush();
        }
    }
}
