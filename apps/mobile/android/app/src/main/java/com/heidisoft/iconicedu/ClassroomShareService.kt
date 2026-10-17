package com.heidisoft.iconicedu

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import us.zoom.sdk.ZoomVideoSDK
import us.zoom.sdk.ZoomVideoSDKSharePreprocessParam
import us.zoom.sdk.ZoomVideoSDKSharePreprocessType
import us.zoom.sdk.IZoomVideoSDKSharePreprocessor

/** MediaProjection consent is granted in MainActivity before starting this service. */
class ClassroomShareService : Service() {
  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel("classroom-share", "Classroom screen sharing", NotificationManager.IMPORTANCE_LOW))
    val notification = NotificationCompat.Builder(this, "classroom-share")
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Sharing your screen with the classroom")
      .setOngoing(true).build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(285, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    else startForeground(285, notification)
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    @Suppress("DEPRECATION")
    val capture = intent?.getParcelableExtra<Intent>("capture")
    if (capture != null) {
      val result = ZoomVideoSDK.getInstance().shareHelper.startShareWithPreprocessing(
        ZoomVideoSDKSharePreprocessParam(ZoomVideoSDKSharePreprocessType.ZoomVideoSDKSharePreprocessType_screen, null, capture),
        object : IZoomVideoSDKSharePreprocessor { override fun onCapturedRawDataReceived(bitmap: android.graphics.Bitmap) { ClassroomComposition.compose(bitmap) } }
      )
      if (result != 0) stopSelf()
    } else stopSelf()
    return START_NOT_STICKY
  }
  override fun onDestroy() { ClassroomComposition.reset(); ZoomVideoSDK.getInstance().shareHelper.stopShare(); super.onDestroy() }
  override fun onTaskRemoved(rootIntent: Intent?) { stopSelf() }
  override fun onBind(intent: Intent?): IBinder? = null
}
