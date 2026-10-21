#import <React/RCTEventEmitter.h>
#import <React/RCTUtils.h>
#import <AVKit/AVKit.h>
#import <ZoomVideoSDK/ZoomVideoSDK.h>

@interface ClassroomPictureInPicture : RCTEventEmitter <RCTBridgeModule, AVPictureInPictureControllerDelegate>
@property(nonatomic, strong) AVPictureInPictureController *controller;
@property(nonatomic, strong) AVPictureInPictureVideoCallViewController *content;
@property(nonatomic, strong) UIView *video;
@property(nonatomic, strong) ZoomVideoSDKVideoCanvas *canvas;
@property(nonatomic, copy) RCTPromiseResolveBlock pendingResolve;
@property(nonatomic, copy) RCTPromiseRejectBlock pendingReject;
@property(nonatomic) BOOL listening;
@property(nonatomic) NSUInteger enterGeneration;
@property(nonatomic) BOOL startRequested;
@end
@implementation ClassroomPictureInPicture
RCT_EXPORT_MODULE(ClassroomPictureInPicture)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (NSArray<NSString *> *)supportedEvents { return @[@"ClassroomPiPChanged"]; }
- (void)startObserving { self.listening = YES; }
- (void)stopObserving { self.listening = NO; }
- (void)notify:(BOOL)active { if (self.listening) [self sendEventWithName:@"ClassroomPiPChanged" body:@{@"active": @(active)}]; }
- (void)clear {
  self.enterGeneration++;
  self.startRequested = NO;
  if (self.pendingReject) self.pendingReject(@"pip_cancelled", @"Floating call was cancelled", nil);
  self.pendingResolve = nil; self.pendingReject = nil;
  [self.controller stopPictureInPicture]; self.controller.delegate = nil; self.controller = nil;
  [self.canvas unSubscribeWithView:self.video]; self.canvas = nil; self.video = nil; self.content = nil;
  [self notify:NO];
}
RCT_EXPORT_METHOD(isSupported:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  if (@available(iOS 16.0, *)) resolve(@([AVPictureInPictureController isPictureInPictureSupported]));
  else resolve(@NO);
}
RCT_EXPORT_METHOD(configure:(NSString *)userId sharing:(BOOL)sharing automatic:(BOOL)automatic resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (userId.length == 0) { [self clear]; resolve(@YES); return; }
    if (@available(iOS 16.0, *)) {
      if (![AVPictureInPictureController isPictureInPictureSupported]) { reject(@"pip_unavailable", @"Floating calls are unavailable on this device", nil); return; }
      ZoomVideoSDKSession *session = [[ZoomVideoSDK shareInstance] getSession];
      NSMutableArray *users = [NSMutableArray arrayWithArray:[session getRemoteUsers] ?: @[]];
      if ([session getMySelf]) [users addObject:[session getMySelf]];
      ZoomVideoSDKUser *target = nil;
      for (ZoomVideoSDKUser *user in users) if ([[NSString stringWithFormat:@"%ld", [user getUserID]] isEqualToString:userId]) target = user;
      if (!target) { reject(@"pip_participant", @"This participant is no longer in the classroom", nil); return; }
      ZoomVideoSDKVideoCanvas *canvas = [target getVideoCanvas];
      if (sharing) {
        canvas = nil;
        for (ZoomVideoSDKShareAction *action in [target getShareActionList]) if ([action getShareStatus] == ZoomVideoSDKReceiveSharingStatus_Start || [action getShareStatus] == ZoomVideoSDKReceiveSharingStatus_Resume) { canvas = [action getShareCanvas]; break; }
      }
      if (!canvas) { reject(@"pip_media", @"This video is not available for a floating call", nil); return; }
      if (!self.controller) {
        UIView *source = RCTPresentedViewController().view.window.rootViewController.view;
        if (!source.window) { reject(@"pip_view", @"Open the classroom before starting a floating call", nil); return; }
        self.content = [AVPictureInPictureVideoCallViewController new];
        self.content.preferredContentSize = CGSizeMake(320, 180);
        self.content.view.bounds = CGRectMake(0, 0, 320, 180);
        self.content.view.backgroundColor = UIColor.blackColor;
        self.video = [[UIView alloc] initWithFrame:self.content.view.bounds];
        self.video.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        [self.content.view addSubview:self.video];
        AVPictureInPictureControllerContentSource *contentSource = [[AVPictureInPictureControllerContentSource alloc] initWithActiveVideoCallSourceView:source contentViewController:self.content];
        self.controller = [[AVPictureInPictureController alloc] initWithContentSource:contentSource];
        self.controller.delegate = self;
      }
      if (self.canvas != canvas) {
        [self.canvas unSubscribeWithView:self.video];
        ZoomVideoSDKError result = [canvas subscribeWithPiPView:self.video aspectMode:ZoomVideoSDKVideoAspect_Original andResolution:ZoomVideoSDKVideoResolution_Auto];
        if (result != Errors_Success) { [self clear]; reject(@"pip_video", @"Unable to prepare floating video", nil); return; }
        self.canvas = canvas;
      }
      self.controller.canStartPictureInPictureAutomaticallyFromInline = automatic;
      resolve(@YES);
    } else reject(@"pip_unavailable", @"Floating calls require iPadOS or iOS 16 or newer", nil);
  });
}
RCT_EXPORT_METHOD(enter:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (!self.controller || self.pendingResolve) { reject(@"pip_not_ready", @"Floating call is not ready. Please try again.", nil); return; }
    NSUInteger generation = ++self.enterGeneration;
    self.pendingResolve = resolve; self.pendingReject = reject;
    self.startRequested = NO;
    [self startWhenPossible:generation];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 8 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
      if (generation == self.enterGeneration && self.pendingReject) { self.pendingReject(@"pip_timeout", @"Unable to open floating call. Please try again.", nil); self.pendingResolve = nil; self.pendingReject = nil; [self.controller stopPictureInPicture]; }
    });
  });
}
// AVKit readiness can lag canvas subscription and dismissal of the More sheet.
// Keep this request bounded by enter's timeout, and cancel it on session cleanup.
- (void)startWhenPossible:(NSUInteger)generation {
  if (generation != self.enterGeneration || !self.pendingResolve || self.startRequested) return;
  if (self.controller.isPictureInPicturePossible) {
    self.startRequested = YES;
    [self.controller startPictureInPicture];
    return;
  }
  __weak ClassroomPictureInPicture *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC / 10), dispatch_get_main_queue(), ^{
    [weakSelf startWhenPossible:generation];
  });
}
- (void)pictureInPictureControllerDidStartPictureInPicture:(AVPictureInPictureController *)controller {
  if (self.pendingResolve) self.pendingResolve(@YES);
  self.pendingResolve = nil; self.pendingReject = nil; self.startRequested = NO; [self notify:YES];
}
- (void)pictureInPictureController:(AVPictureInPictureController *)controller failedToStartPictureInPictureWithError:(NSError *)error {
  if (self.pendingReject) self.pendingReject(@"pip_failed", @"Unable to open floating call", error);
  self.pendingResolve = nil; self.pendingReject = nil; self.startRequested = NO; [self notify:NO];
}
- (void)pictureInPictureControllerDidStopPictureInPicture:(AVPictureInPictureController *)controller { [self notify:NO]; }
- (void)pictureInPictureController:(AVPictureInPictureController *)controller restoreUserInterfaceForPictureInPictureStopWithCompletionHandler:(void (^)(BOOL))completionHandler { completionHandler(YES); }
- (void)invalidate { dispatch_async(dispatch_get_main_queue(), ^{ [self clear]; }); [super invalidate]; }
@end
