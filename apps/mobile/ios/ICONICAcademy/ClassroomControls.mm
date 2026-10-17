#import <React/RCTEventEmitter.h>
#import <React/RCTUtils.h>
#import <React/RCTUIManager.h>
#import <AVFoundation/AVFoundation.h>
#import <AudioToolbox/AudioToolbox.h>
#import <ReplayKit/ReplayKit.h>
#import <ZoomVideoSDK/ZoomVideoSDK.h>
// Use Apple's visible control. Programmatically tapping its private button can
// silently fail, especially while a React Native modal is being dismissed.
@interface ClassroomBroadcastController : UIViewController <UIAdaptivePresentationControllerDelegate>
@property(nonatomic, strong) RPSystemBroadcastPickerView *picker;
@property(nonatomic, strong) NSTimer *statusTimer;
@end
@implementation ClassroomBroadcastController
- (void)viewDidLoad {
  [super viewDidLoad];
  self.view.backgroundColor = UIColor.systemBackgroundColor;
  UILabel *title = [UILabel new];
  title.text = @"Share screen";
  title.font = [UIFont preferredFontForTextStyle:UIFontTextStyleHeadline];
  UILabel *instructions = [UILabel new];
  instructions.text = @"Tap the broadcast button, then Start Broadcast. Everything on your screen will be visible to the class.";
  instructions.font = [UIFont preferredFontForTextStyle:UIFontTextStyleSubheadline];
  instructions.textColor = UIColor.secondaryLabelColor;
  instructions.numberOfLines = 0;
  instructions.textAlignment = NSTextAlignmentCenter;
  self.picker = [[RPSystemBroadcastPickerView alloc] initWithFrame:CGRectMake(0, 0, 64, 64)];
  self.picker.preferredExtension = @"com.heidisoft.iconicedu.classroom-broadcast";
  self.picker.showsMicrophoneButton = NO;
  self.picker.accessibilityLabel = @"Start screen broadcast";
  [self.picker.widthAnchor constraintEqualToConstant:64].active = YES;
  [self.picker.heightAnchor constraintEqualToConstant:64].active = YES;
  // Expose the same accessible name on the actual UIKit control.
  for (UIView *view in self.picker.subviews)
    if ([view isKindOfClass:UIButton.class]) view.accessibilityLabel = @"Start screen broadcast";
  UIButton *cancel = [UIButton buttonWithType:UIButtonTypeSystem];
  [cancel setTitle:@"Cancel" forState:UIControlStateNormal];
  [cancel addTarget:self action:@selector(close) forControlEvents:UIControlEventTouchUpInside];
  [cancel.heightAnchor constraintGreaterThanOrEqualToConstant:44].active = YES;
  UIStackView *stack = [[UIStackView alloc] initWithArrangedSubviews:@[title, instructions, self.picker, cancel]];
  stack.axis = UILayoutConstraintAxisVertical;
  stack.alignment = UIStackViewAlignmentCenter;
  stack.spacing = 12;
  stack.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:stack];
  [NSLayoutConstraint activateConstraints:@[
    [stack.leadingAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.leadingAnchor constant:24],
    [stack.trailingAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.trailingAnchor constant:-24],
    [stack.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:24],
    [stack.bottomAnchor constraintLessThanOrEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-12],
    [instructions.widthAnchor constraintEqualToAnchor:stack.widthAnchor]
  ]];
}
- (void)viewDidAppear:(BOOL)animated {
  [super viewDidAppear:animated];
  self.presentationController.delegate = self;
  [self.statusTimer invalidate];
  __weak ClassroomBroadcastController *weakSelf = self;
  self.statusTimer = [NSTimer scheduledTimerWithTimeInterval:0.5 repeats:YES block:^(NSTimer *timer) {
    ClassroomBroadcastController *controller = weakSelf;
    if (!controller) { [timer invalidate]; return; }
    if (![[ZoomVideoSDK sharedInstance] isInSession] || [[[ZoomVideoSDK sharedInstance] getShareHelper] isScreenSharingOut])
      [controller close];
  }];
}
- (void)close {
  [self.statusTimer invalidate];
  self.statusTimer = nil;
  [self dismissViewControllerAnimated:YES completion:nil];
}
- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  [self.statusTimer invalidate];
  self.statusTimer = nil;
}
- (void)dealloc { [self.statusTimer invalidate]; }
@end

@interface ClassroomControls : RCTEventEmitter <RCTBridgeModule>
@property(nonatomic, strong) ClassroomBroadcastController *broadcastController;
@property(nonatomic) BOOL listening;
@property(nonatomic) BOOL publishingView;
@property(nonatomic) BOOL observingInterruptions;
@property(nonatomic) SystemSoundID joinChime;
@end
@implementation ClassroomControls
RCT_EXPORT_MODULE(ClassroomControls)
- (NSURL *)compositionFile:(NSString *)name {
  NSURL *root = [NSFileManager.defaultManager containerURLForSecurityApplicationGroupIdentifier:@"group.com.heidisoft.iconicedu.classroom"];
  return root ? [root URLByAppendingPathComponent:name] : nil;
}
RCT_EXPORT_METHOD(setShareOverlay:(NSString *)dataUrl resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSURL *url = [self compositionFile:@"classroom-overlay.png"];
  if (!url) { reject(@"composition", @"Screen composition is unavailable in this build.", nil); return; }
  if (!dataUrl.length) { [NSFileManager.defaultManager removeItemAtURL:url error:nil]; resolve(@YES); return; }
  NSString *prefix = @"data:image/png;base64,";
  if (![dataUrl hasPrefix:prefix] || dataUrl.length > 28000000) { reject(@"composition", @"Invalid annotation image.", nil); return; }
  NSData *data = [[NSData alloc] initWithBase64EncodedString:[dataUrl substringFromIndex:prefix.length] options:0];
  if (data && [data writeToURL:url atomically:YES]) resolve(@YES);
  else reject(@"composition", @"Unable to publish annotations.", nil);
}
RCT_EXPORT_METHOD(startWhiteboardShare:(nonnull NSNumber *)tag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *manager, NSDictionary<NSNumber *, UIView *> *registry) {
    UIView *view = registry[tag];
    if (!view || CGRectIsEmpty(view.bounds)) { reject(@"composition", @"Wait for the whiteboard to load, then retry.", nil); return; }
    ZoomVideoSDKShareHelper *share = [[ZoomVideoSDK sharedInstance] getShareHelper];
    if ([share isSharingOut]) { reject(@"composition", @"Stop screen sharing before publishing the whiteboard.", nil); return; }
    ZoomVideoSDKError result = [share startShareWithView:view];
    self.publishingView = result == Errors_Success;
    if (self.publishingView) resolve(@YES); else reject(@"composition", @"Unable to publish the whiteboard.", nil);
  }];
}
RCT_EXPORT_METHOD(compositionStatus:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    ZoomVideoSDKShareHelper *share = [[ZoomVideoSDK sharedInstance] getShareHelper];
    if (![share isSharingOut]) self.publishingView = NO;
    NSString *frame = [NSString stringWithContentsOfURL:[self compositionFile:@"classroom-composition-frame"] encoding:NSUTF8StringEncoding error:nil];
    NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:[self compositionFile:@"classroom-overlay.png"].path error:nil];
    NSTimeInterval now = NSDate.date.timeIntervalSince1970;
    BOOL overlayFresh = attributes && now - [attributes[NSFileModificationDate] timeIntervalSince1970] < 5;
    BOOL active = self.publishingView || ([share isScreenSharingOut] && overlayFresh && now - frame.doubleValue < 3);
    resolve(@(active));
  });
}
RCT_EXPORT_METHOD(copyText:(NSString *)text resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{ UIPasteboard.generalPasteboard.string = text; resolve(@YES); });
}
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
    if (![[ZoomVideoSDK sharedInstance] isInSession]) {
      reject(@"screen_share", @"Join the class before sharing your screen.", nil); return;
    }
    NSURL *extensionURL = [NSBundle.mainBundle.builtInPlugInsURL URLByAppendingPathComponent:@"ClassroomBroadcast.appex"];
    NSBundle *extension = extensionURL ? [NSBundle bundleWithURL:extensionURL] : nil;
    if (![extension.bundleIdentifier isEqualToString:@"com.heidisoft.iconicedu.classroom-broadcast"]) {
      reject(@"screen_share", @"Screen sharing is missing from this app build. Install the latest native build and retry.", nil); return;
    }
    if (![NSFileManager.defaultManager containerURLForSecurityApplicationGroupIdentifier:@"group.com.heidisoft.iconicedu.classroom"]) {
      reject(@"screen_share", @"Screen sharing is unavailable in this app build. Install the latest signed native build and retry.", nil); return;
    }
    UIViewController *presenter = RCTPresentedViewController();
    if (!presenter || !presenter.view.window || presenter.isBeingDismissed) {
      reject(@"screen_share", @"Wait for the menu to close, then try sharing again.", nil); return;
    }
    if (self.broadcastController.presentingViewController) {
      reject(@"screen_share", @"The screen broadcast control is already open.", nil); return;
    }
    ClassroomBroadcastController *controller = [ClassroomBroadcastController new];
    controller.modalPresentationStyle = UIModalPresentationPageSheet;
    controller.sheetPresentationController.prefersGrabberVisible = YES;
    if (@available(iOS 16.0, *)) {
      controller.sheetPresentationController.detents = @[[UISheetPresentationControllerDetent customDetentWithIdentifier:@"broadcast" resolver:^CGFloat(id<UISheetPresentationControllerDetentResolutionContext> context) { return MIN(300, context.maximumDetentValue); }]];
    } else {
      controller.sheetPresentationController.detents = @[UISheetPresentationControllerDetent.mediumDetent];
    }
    self.broadcastController = controller;
    [presenter presentViewController:controller animated:YES completion:^{ resolve(@YES); }];
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
    if (self.broadcastController.presentingViewController) [self.broadcastController close];
    self.broadcastController = nil;
    self.publishingView = NO;
    [NSFileManager.defaultManager removeItemAtURL:[self compositionFile:@"classroom-overlay.png"] error:nil];
    [NSFileManager.defaultManager removeItemAtURL:[self compositionFile:@"classroom-composition-frame"] error:nil];
    resolve(@YES);
  });
}
@end
