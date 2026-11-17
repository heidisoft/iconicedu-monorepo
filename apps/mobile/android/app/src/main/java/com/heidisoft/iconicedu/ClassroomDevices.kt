package com.heidisoft.iconicedu
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import com.facebook.react.bridge.*

class ClassroomDevices(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "ClassroomDevices"
  private val audio get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  @ReactMethod fun getAudioRoutes(promise: Promise) {
    try {
      val routes = Arguments.createArray()
      fun add(id: String, label: String, selected: Boolean) {
        val value = Arguments.createMap(); value.putString("id", id); value.putString("label", label); value.putBoolean("selected", selected); routes.pushMap(value)
      }
      if (Build.VERSION.SDK_INT >= 31) {
        val current = audio.communicationDevice
        add("auto", "System default", current == null)
        for (device in audio.availableCommunicationDevices) {
          val label = when (device.type) {
            AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Speaker"
            AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Earpiece"
            else -> device.productName.toString()
          }
          add(device.id.toString(), label, current?.id == device.id)
        }
      } else {
        @Suppress("DEPRECATION") val speaker = audio.isSpeakerphoneOn
        add("auto", "System default / connected headset", !speaker)
        add("speaker", "Speaker", speaker)
      }
      promise.resolve(routes)
    } catch (error: Exception) { promise.reject("audio_devices", "Unable to list connected audio devices", error) }
  }
  @ReactMethod fun selectAudioRoute(id: String, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= 31) {
        if (id == "auto") audio.clearCommunicationDevice()
        else {
          val device = audio.availableCommunicationDevices.find { it.id.toString() == id }
          if (device == null) { promise.reject("audio_device", "This audio device disconnected. Choose another device."); return }
          if (!audio.setCommunicationDevice(device)) { promise.reject("audio_device", "Unable to select this audio device"); return }
        }
      } else {
        @Suppress("DEPRECATION")
        if (id == "auto" || id == "speaker") audio.isSpeakerphoneOn = id == "speaker"
        else { promise.reject("audio_device", "Choose system default or speaker on this Android version"); return }
      }
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("audio_device", "Unable to select this audio device", error) }
  }
}
