#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <ReplayKit/ReplayKit.h>
#import <ZoomVideoSDK/ZoomVideoSDK.h>
@interface ClassroomControls : NSObject <RCTBridgeModule>
@property(nonatomic, strong) RPSystemBroadcastPickerView *broadcastPicker;
@end
@implementation ClassroomControls
RCT_EXPORT_MODULE(ClassroomControls)
+ (BOOL)requiresMainQueueSetup { return YES; }
RCT_EXPORT_METHOD(claimHost:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if ([[[ZoomVideoSDK shareInstance] getUserHelper] reclaimHost]) resolve(@YES);
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
    ZoomVideoSDKShareHelper *share = [[ZoomVideoSDK shareInstance] getShareHelper];
    resolve([share isShareLocked] ? @"locked" : [share isMultiShareEnabled] ? @"multiple" : @"single");
  });
}
RCT_EXPORT_METHOD(setShareMode:(NSString *)mode resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    ZoomVideoSDKShareHelper *share = [[ZoomVideoSDK shareInstance] getShareHelper];
    BOOL locked = [mode isEqualToString:@"locked"];
    ZoomVideoSDKError lockResult = [share lockShare:locked];
    ZoomVideoSDKError multiResult = locked ? Errors_Success : [share enableMultiShare:[mode isEqualToString:@"multiple"]];
    if (lockResult == Errors_Success && multiResult == Errors_Success) resolve(@YES);
    else reject(@"share_mode", @"Unable to change who can share", nil);
  });
}
RCT_EXPORT_METHOD(startMeetingService:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { resolve(@YES); }
RCT_EXPORT_METHOD(stopMeetingService:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { resolve(@YES); }
RCT_EXPORT_METHOD(stopShareService:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.broadcastPicker removeFromSuperview];
    self.broadcastPicker = nil;
    resolve(@YES);
  });
}
@end
