package app.questie;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), AudioService.class).putExtra("title", call.getString("title"));
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (RuntimeException e) { // Android 12+ refuses to start one from the background
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AudioService.class));
        call.resolve();
    }
}
