package com.heidisoft.iconicedu
import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import us.zoom.sdk.ZoomVideoSDK

/** Keeps an explicitly joined class audible when the app is backgrounded. */
class ClassroomAudioService : Service() {
  override fun onCreate() {
    super.onCreate()
    getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel("classroom-audio", "Classroom audio", NotificationManager.IMPORTANCE_LOW))
    val notification = NotificationCompat.Builder(this, "classroom-audio").setSmallIcon(applicationInfo.icon).setContentTitle("Classroom meeting in progress").setOngoing(true).build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      var types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      startForeground(286, notification, types)
    } else startForeground(286, notification)
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_NOT_STICKY
  override fun onTaskRemoved(rootIntent: Intent?) { ZoomVideoSDK.getInstance().leaveSession(false); stopSelf() }
  override fun onBind(intent: Intent?): IBinder? = null
}
