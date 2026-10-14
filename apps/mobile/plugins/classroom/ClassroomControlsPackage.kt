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
  /** Web's share privilege has no RN wrapper equivalent; 0 is ZoomVideoSDKErrors.Errors_Success. */
  @ReactMethod fun getShareMode(promise: Promise) {
    val share = ZoomVideoSDK.getInstance().shareHelper
    promise.resolve(if (share.isShareLocked) "locked" else if (share.isMultiShareEnabled) "multiple" else "single")
  }
  @ReactMethod fun setShareMode(mode: String, promise: Promise) {
    val share = ZoomVideoSDK.getInstance().shareHelper
    val locked = share.lockShare(mode == "locked")
    val multiple = if (mode == "locked") 0 else share.enableMultiShare(mode == "multiple")
    if (locked == 0 && multiple == 0) promise.resolve(true)
    else promise.reject("share_mode", "Unable to change who can share")
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
