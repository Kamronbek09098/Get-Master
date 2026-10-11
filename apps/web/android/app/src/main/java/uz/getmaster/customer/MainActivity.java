package uz.getmaster.customer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(DeviceLocationPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
