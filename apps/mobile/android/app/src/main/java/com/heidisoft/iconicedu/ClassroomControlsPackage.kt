package com.heidisoft.iconicedu
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
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
  /** Web's join chime (E5 then B5, 180ms each) on the call-signalling stream, so it never takes audio focus from Zoom. */
  @ReactMethod fun playJoinChime(promise: Promise) {
    try {
      val rate = 44100
      val notes = arrayOf(doubleArrayOf(659.25, 0.0), doubleArrayOf(987.77, 0.12))
      val samples = ShortArray((rate * 0.32).toInt()) { index ->
        val time = index.toDouble() / rate
        var value = 0.0
        for (note in notes) {
          val local = time - note[1]
          if (local < 0 || local > 0.2) continue
          val gain = when {
            local < 0.02 -> 0.2 * local / 0.02
            local < 0.18 -> 0.2 * (0.0001 / 0.2).pow((local - 0.02) / 0.16)
            else -> 0.0
          }
          value += gain * sin(2 * PI * note[0] * local)
        }
        (max(-1.0, min(1.0, value)) * Short.MAX_VALUE).toInt().toShort()
      }
      val track = AudioTrack.Builder()
        .setAudioAttributes(AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION_SIGNALLING)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build())
        .setAudioFormat(AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(rate)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build())
        .setTransferMode(AudioTrack.MODE_STATIC)
        .setBufferSizeInBytes(samples.size * 2)
        .build()
      track.write(samples, 0, samples.size)
      track.setNotificationMarkerPosition(samples.size)
      track.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
        override fun onMarkerReached(finished: AudioTrack) { finished.release() }
        override fun onPeriodicNotification(ignored: AudioTrack) {}
      })
      track.play()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.resolve(false)
    }
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
