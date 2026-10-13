package com.heidisoft.iconicedu
import android.content.Intent
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import us.zoom.sdk.ZoomVideoSDK

class ClassroomControlsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "ClassroomControls"
  @ReactMethod fun startMeetingService(promise: Promise) {
    try { context.startForegroundService(Intent(context, ClassroomAudioService::class.java)); promise.resolve(true) }
    catch (error: Exception) { promise.reject("audio_service", "Keep the app open to continue classroom audio", error) }
  }
  @ReactMethod fun stopMeetingService(promise: Promise) { context.stopService(Intent(context, ClassroomAudioService::class.java)); promise.resolve(true) }
  @ReactMethod fun claimHost(promise: Promise) {
    if (ZoomVideoSDK.getInstance().userHelper.reclaimHost()) promise.resolve(true)
    else promise.reject("host_access", "Unable to claim host access")
  }
  @ReactMethod fun stopShareService(promise: Promise) {
    context.stopService(Intent(context, ClassroomShareService::class.java))
    promise.resolve(true)
  }
}
class ClassroomControlsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(ClassroomControlsModule(context), ClassroomDevices(context), ClassroomPictureInPicture(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = listOf(ClassroomVideoViewManager())
}
