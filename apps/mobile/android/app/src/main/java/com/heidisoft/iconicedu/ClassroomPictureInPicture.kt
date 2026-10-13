package com.heidisoft.iconicedu
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class ClassroomPictureInPicture(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  companion object {
    var automatic = false
    private var emitter: ReactApplicationContext? = null
    fun changed(active: Boolean) {
      val context = emitter ?: return
      if (context.hasActiveReactInstance()) context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("ClassroomPiPChanged", Arguments.createMap().apply { putBoolean("active", active) })
    }
  }
  init { emitter = context }
  override fun getName() = "ClassroomPictureInPicture"
  @ReactMethod fun addListener(name: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
  @ReactMethod fun isSupported(promise: Promise) { promise.resolve(context.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) }
  @ReactMethod fun configure(userId: String, sharing: Boolean, auto: Boolean, promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) { promise.reject("pip_activity", "Open the classroom to configure floating calls"); return }
    activity.runOnUiThread {
      try {
        automatic = userId.isNotEmpty() && auto
        val builder = PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9))
        if (Build.VERSION.SDK_INT >= 31) builder.setAutoEnterEnabled(automatic)
        activity.setPictureInPictureParams(builder.build())
        promise.resolve(true)
      } catch (error: Exception) { promise.reject("pip_configuration", "Floating calls are unavailable on this device", error) }
    }
  }
  @ReactMethod fun enter(promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) { promise.reject("pip_activity", "Open the classroom before starting a floating call"); return }
    activity.runOnUiThread {
      try {
        val accepted = activity.enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9)).build())
        if (accepted) promise.resolve(true) else promise.reject("pip_unavailable", "Enable picture-in-picture for ICONIC Academy in system settings")
      } catch (error: Exception) { promise.reject("pip_unavailable", "Unable to open floating call", error) }
    }
  }
  override fun invalidate() { if (emitter === context) { automatic = false; emitter = null }; super.invalidate() }
}
