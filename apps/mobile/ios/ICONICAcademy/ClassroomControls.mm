#import <React/RCTEventEmitter.h>
#import <React/RCTUtils.h>
#import <AVFoundation/AVFoundation.h>
#import <AudioToolbox/AudioToolbox.h>
#import <ReplayKit/ReplayKit.h>
#import <ZoomVideoSDK/ZoomVideoSDK.h>
@interface ClassroomControls : RCTEventEmitter <RCTBridgeModule>
@property(nonatomic, strong) RPSystemBroadcastPickerView *broadcastPicker;
@property(nonatomic) BOOL listening;
@property(nonatomic) BOOL observingInterruptions;
@property(nonatomic) SystemSoundID joinChime;
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
- (void)invalidate {
  [self observeInterruptions:NO];
  if (self.joinChime) AudioServicesDisposeSystemSoundID(self.joinChime);
  self.joinChime = 0;
  [super invalidate];
}
// Web's join chime (E5 then B5, 180ms each) rendered once to a WAV. System sounds do not
// change the AVAudioSession that Zoom owns during a call.
- (SystemSoundID)loadJoinChime {
  if (self.joinChime) return self.joinChime;
  const int rate = 44100;
  const double notes[2][2] = {{659.25, 0.0}, {987.77, 0.12}};
  const int frames = (int)(rate * 0.32);
  NSMutableData *pcm = [NSMutableData dataWithLength:frames * sizeof(int16_t)];
  int16_t *samples = (int16_t *)pcm.mutableBytes;
  for (int i = 0; i < frames; i++) {
    double t = (double)i / rate, value = 0;
    for (int n = 0; n < 2; n++) {
      double local = t - notes[n][1];
      if (local < 0 || local > 0.2) continue;
      double gain = local < 0.02 ? 0.2 * local / 0.02 : local < 0.18 ? 0.2 * pow(0.0001 / 0.2, (local - 0.02) / 0.16) : 0;
      value += gain * sin(2 * M_PI * notes[n][0] * local);
    }
    samples[i] = (int16_t)(fmax(-1, fmin(1, value)) * 32767);
  }
  NSMutableData *wav = [NSMutableData data];
  uint32_t dataSize = (uint32_t)pcm.length, chunk = 36 + dataSize, fmtSize = 16, byteRate = rate * 2, sampleRate = rate;
  uint16_t format = 1, channels = 1, align = 2, bits = 16;
  [wav appendBytes:"RIFF" length:4]; [wav appendBytes:&chunk length:4]; [wav appendBytes:"WAVEfmt " length:8];
  [wav appendBytes:&fmtSize length:4]; [wav appendBytes:&format length:2]; [wav appendBytes:&channels length:2];
  [wav appendBytes:&sampleRate length:4]; [wav appendBytes:&byteRate length:4]; [wav appendBytes:&align length:2];
  [wav appendBytes:&bits length:2]; [wav appendBytes:"data" length:4]; [wav appendBytes:&dataSize length:4];
  [wav appendData:pcm];
  NSURL *url = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:@"classroom-join-chime.wav"]];
  SystemSoundID sound = 0;
  if ([wav writeToURL:url atomically:YES] && AudioServicesCreateSystemSoundID((__bridge CFURLRef)url, &sound) == kAudioServicesNoError)
    self.joinChime = sound;
  return self.joinChime;
}
RCT_EXPORT_METHOD(playJoinChime:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    SystemSoundID sound = [self loadJoinChime];
    if (sound) AudioServicesPlaySystemSound(sound);
    resolve(@(sound != 0));
  });
}
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
