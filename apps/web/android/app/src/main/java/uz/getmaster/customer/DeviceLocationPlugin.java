package uz.getmaster.customer;

import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Qurilmaning joylashuv xizmati (GPS) yoqilganini tekshiradi va o‘chiq bo‘lsa sozlamalarni ochadi. */
@CapacitorPlugin(name = "DeviceLocation")
public class DeviceLocationPlugin extends Plugin {

  @PluginMethod
  public void isEnabled(PluginCall call) {
    LocationManager manager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
    boolean on;
    if (manager == null) {
      on = false;
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      on = manager.isLocationEnabled();
    } else {
      on = manager.isProviderEnabled(LocationManager.GPS_PROVIDER) || manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }
    JSObject result = new JSObject();
    result.put("enabled", on);
    call.resolve(result);
  }

  @PluginMethod
  public void openSettings(PluginCall call) {
    Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
    call.resolve();
  }
}
