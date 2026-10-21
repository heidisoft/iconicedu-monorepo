#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
@interface ClassroomDevices : NSObject <RCTBridgeModule>
@end
@implementation ClassroomDevices
RCT_EXPORT_MODULE(ClassroomDevices)
+ (BOOL)requiresMainQueueSetup { return YES; }
RCT_EXPORT_METHOD(getAudioRoutes:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    AVAudioSession *session = AVAudioSession.sharedInstance;
    BOOL speaker = [session.currentRoute.outputs.firstObject.portType isEqualToString:AVAudioSessionPortBuiltInSpeaker];
    NSString *output = session.currentRoute.outputs.firstObject.portName ?: @"Automatic";
    NSMutableArray *routes = [NSMutableArray arrayWithArray:@[
      @{@"id": @"auto", @"label": [@"System default — " stringByAppendingString:output], @"selected": @(!session.preferredInput && !speaker)},
      @{@"id": @"speaker", @"label": @"Speaker", @"selected": @(speaker)}
    ]];
    for (AVAudioSessionPortDescription *port in session.availableInputs) {
      [routes addObject:@{@"id": port.UID, @"label": port.portName, @"selected": @([session.preferredInput.UID isEqualToString:port.UID] && !speaker)}];
    }
    resolve(routes);
  });
}
RCT_EXPORT_METHOD(getAudioInputs:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    AVAudioSession *session = AVAudioSession.sharedInstance;
    AVAudioSessionPortDescription *current = session.currentRoute.inputs.firstObject;
    NSString *currentName = [current.portType isEqualToString:AVAudioSessionPortBuiltInMic] ? @"Built-in microphone" : (current.portName ?: @"Microphone");
    NSMutableArray *inputs = [NSMutableArray arrayWithObject:@{@"id": @"auto", @"label": [@"System default — " stringByAppendingString:currentName], @"selected": @(!session.preferredInput)}];
    for (AVAudioSessionPortDescription *port in session.availableInputs) {
      NSString *name = [port.portType isEqualToString:AVAudioSessionPortBuiltInMic] ? @"Built-in microphone" : port.portName;
      [inputs addObject:@{@"id": port.UID, @"label": name, @"selected": @(session.preferredInput != nil && [current.UID isEqualToString:port.UID])}];
    }
    resolve(inputs);
  });
}
RCT_EXPORT_METHOD(selectAudioInput:(NSString *)inputId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    AVAudioSession *session = AVAudioSession.sharedInstance;
    AVAudioSessionPortDescription *target = nil;
    for (AVAudioSessionPortDescription *port in session.availableInputs) if ([port.UID isEqualToString:inputId]) target = port;
    if (![inputId isEqualToString:@"auto"] && !target) { reject(@"audio_input", @"This microphone disconnected. Choose another microphone.", nil); return; }
    NSError *error = nil;
    if ([session setPreferredInput:target error:&error]) resolve(@YES);
    else reject(@"audio_input", @"Unable to select this microphone. Start the audio self-check and try again.", error);
  });
}
RCT_EXPORT_METHOD(selectAudioRoute:(NSString *)routeId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    AVAudioSession *session = AVAudioSession.sharedInstance;
    NSError *error = nil;
    BOOL success = NO;
    if ([routeId isEqualToString:@"speaker"]) success = [session overrideOutputAudioPort:AVAudioSessionPortOverrideSpeaker error:&error];
    else {
      AVAudioSessionPortDescription *target = nil;
      for (AVAudioSessionPortDescription *port in session.availableInputs) if ([port.UID isEqualToString:routeId]) target = port;
      if (![routeId isEqualToString:@"auto"] && !target) { reject(@"audio_device", @"This audio device disconnected. Choose another device.", nil); return; }
      success = [session overrideOutputAudioPort:AVAudioSessionPortOverrideNone error:&error] && [session setPreferredInput:target error:&error];
    }
    if (success) resolve(@YES);
    else reject(@"audio_device", @"Unable to select audio. Start the audio self-check and try again.", error);
  });
}
@end
