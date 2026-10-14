#import <React/RCTEventEmitter.h>
#import <React/RCTUtils.h>
#import <AVFoundation/AVFoundation.h>
#import <ReplayKit/ReplayKit.h>
#import <ZoomVideoSDK/ZoomVideoSDK.h>
@interface ClassroomControls : RCTEventEmitter <RCTBridgeModule>
@property(nonatomic, strong) RPSystemBroadcastPickerView *broadcastPicker;
@property(nonatomic) BOOL listening;
@property(nonatomic) BOOL observingInterruptions;
@end
@implementation ClassroomControls
RCT_EXPORT_MODULE(ClassroomControls)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (NSArray<NSString *> *)supportedEvents { return @[@"ClassroomAudioInterrupted"]; }
- (void)startObserving { self.listening = YES; }
- (void)stopObserving { self.listening = NO; }
// Phone calls and Siri can interrupt class audio without the app leaving the foreground
// (for example an iPad call banner), so recovery cannot rely on AppState alone.
- (void)audioInterrupted:(NSNotification *)notification {
  NSUInteger type = [notification.userInfo[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue];
  BOOL began = type == AVAudioSessionInterruptionTypeBegan;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (!began && [[ZoomVideoSDK sharedInstance] isInSession])
      [[[ZoomVideoSDK sharedInstance] getAudioHelper] setSDKAudioSessionEnv];
    if (self.listening) [self sendEventWithName:@"ClassroomAudioInterrupted" body:@{@"active": @(began)}];
  });
}
- (void)observeInterruptions:(BOOL)enabled {
  if (enabled == self.observingInterruptions) return;
  self.observingInterruptions = enabled;
  NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
  if (enabled)
    [center addObserver:self selector:@selector(audioInterrupted:) name:AVAudioSessionInterruptionNotification object:nil];
  else
    [center removeObserver:self name:AVAudioSessionInterruptionNotification object:nil];
}
- (void)invalidate { [self observeInterruptions:NO]; [super invalidate]; }
RCT_EXPORT_METHOD(claimHost:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if ([[[ZoomVideoSDK sharedInstance] getUserHelper] reclaimHost]) resolve(@YES);
    else reject(@"host_access", @"Unable to claim host access", nil);
  });
}
RCT_EXPORT_METHOD(startScreenShare:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    RPSystemBroadcastPickerView *picker = [[RPSystemBroadcastPickerView alloc] initWithFrame:CGRectMake(0, 0, 44, 44)];
    picker.preferredExtension = @"com.heidisoft.iconicedu.classroom-broadcast";
    picker.showsMicrophoneButton = NO;
    UIViewController *controller = RCTPresentedViewController();
    if (!controller) { reject(@"screen_share", @"Unable to open screen sharing", nil); return; }
    [self.broadcastPicker removeFromSuperview];
    self.broadcastPicker = picker;
    picker.alpha = 0.01;
    picker.userInteractionEnabled = NO;
    [controller.view addSubview:picker];
    for (UIView *view in picker.subviews) if ([view isKindOfClass:UIButton.class]) { [(UIButton *)view sendActionsForControlEvents:UIControlEventTouchUpInside]; break; }
    resolve(@YES);
  });
}
// Web's share privilege has no RN wrapper equivalent.
RCT_EXPORT_METHOD(getShareMode:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    ZoomVideoSDKShareHelper *share = [[ZoomVideoSDK sharedInstance] getShareHelper];
    resolve([share isShareLocked] ? @"locked" : [share isMultiShareEnabled] ? @"multiple" : @"single");
  });
}
RCT_EXPORT_METHOD(setShareMode:(NSString *)mode resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    ZoomVideoSDKShareHelper *share = [[ZoomVideoSDK sharedInstance] getShareHelper];
    BOOL locked = [mode isEqualToString:@"locked"];
    ZoomVideoSDKError lockResult = [share lockShare:locked];
    ZoomVideoSDKError multiResult = locked ? Errors_Success : [share enableMultiShare:[mode isEqualToString:@"multiple"]];
    if (lockResult == Errors_Success && multiResult == Errors_Success) resolve(@YES);
    else reject(@"share_mode", @"Unable to change who can share", nil);
  });
}
RCT_EXPORT_METHOD(startMeetingService:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{ [self observeInterruptions:YES]; resolve(@YES); });
}
RCT_EXPORT_METHOD(stopMeetingService:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{ [self observeInterruptions:NO]; resolve(@YES); });
}
RCT_EXPORT_METHOD(stopShareService:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.broadcastPicker removeFromSuperview];
    self.broadcastPicker = nil;
    resolve(@YES);
  });
}
@end
