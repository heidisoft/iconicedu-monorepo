package com.heidisoft.iconicedu

import android.content.Context
import android.content.res.Configuration
import android.widget.FrameLayout
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import us.zoom.sdk.*

/** A view owns its own subscription; React ViewManagers are shared across all tiles. */
class ClassroomVideoView(context: Context) : FrameLayout(context) {
  val video = ZoomVideoSDKVideoView(context)
  var userId: String? = null
  var sharing = false
  var preview = false
  var aspect = ZoomVideoSDKVideoAspect.ZoomVideoSDKVideoAspect_LetterBox
  private var canvas: ZoomVideoSDKVideoCanvas? = null
  private var previewRunning = false
  private var retries = 0
  private val retry = Runnable { refresh() }
  init { video.setZOrderOnTop(false); video.setZOrderMediaOverlay(false); addView(video, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)) }
  fun cleanup() {
    removeCallbacks(retry)
    if (previewRunning) ZoomVideoSDK.getInstance().videoHelper.stopVideoCanvasPreview(video)
    previewRunning = false
    canvas?.unSubscribe(video)
    canvas = null
  }
  fun refresh() {
    cleanup()
    if (!isAttachedToWindow || width == 0 || height == 0) return
    val sdk = ZoomVideoSDK.getInstance()
    if (preview) {
      sdk.videoHelper.startVideoCanvasPreview(video, aspect)
      previewRunning = true
      return
    }
    if (!sdk.isInSession) return
    val session = sdk.session
    val users = listOfNotNull(session.mySelf) + session.remoteUsers
    val user = users.find { it.userID == userId } ?: return
    canvas = if (sharing) user.shareActionList.firstOrNull { it.shareStatus == ZoomVideoSDKShareStatus.ZoomVideoSDKShareStatus_Start || it.shareStatus == ZoomVideoSDKShareStatus.ZoomVideoSDKShareStatus_Resume }?.shareCanvas else user.videoCanvas
    canvas?.subscribe(video, aspect, ZoomVideoSDKVideoResolution.ZoomVideoSDKResolution_Auto)
    if (canvas == null && retries++ < 10) postDelayed(retry, 200)
  }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); retries = 0; post { refresh() } }
  override fun onDetachedFromWindow() { cleanup(); super.onDetachedFromWindow() }
  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) { super.onSizeChanged(w, h, oldw, oldh); refresh() }
  override fun onConfigurationChanged(config: Configuration) {
    super.onConfigurationChanged(config)
    val sdk = ZoomVideoSDK.getInstance()
    if (preview || (sdk.isInSession && sdk.session.mySelf?.userID == userId)) sdk.videoHelper.rotateMyVideo(display?.rotation ?: 0)
    refresh()
  }
}
class ClassroomVideoViewManager : SimpleViewManager<ClassroomVideoView>() {
  override fun getName() = "ClassroomVideoView"
  override fun createViewInstance(context: ThemedReactContext) = ClassroomVideoView(context)
  @ReactProp(name = "userId") fun userId(view: ClassroomVideoView, id: String?) { view.userId = id; view.refresh() }
  @ReactProp(name = "sharing") fun sharing(view: ClassroomVideoView, enabled: Boolean) { view.sharing = enabled; view.refresh() }
  @ReactProp(name = "preview") fun preview(view: ClassroomVideoView, enabled: Boolean) { view.preview = enabled; view.refresh() }
  @ReactProp(name = "videoAspect") fun aspect(view: ClassroomVideoView, value: String?) { view.aspect = if (value?.endsWith("PanAndScan") == true) ZoomVideoSDKVideoAspect.ZoomVideoSDKVideoAspect_PanAndScan else ZoomVideoSDKVideoAspect.ZoomVideoSDKVideoAspect_LetterBox; view.refresh() }
  override fun onDropViewInstance(view: ClassroomVideoView) { view.cleanup(); super.onDropViewInstance(view) }
}
