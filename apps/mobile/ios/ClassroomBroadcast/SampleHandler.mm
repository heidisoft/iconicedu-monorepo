#import <ReplayKit/ReplayKit.h>
#import <CoreImage/CoreImage.h>
#import <ZoomVideoSDKScreenShare/ZoomVideoSDKScreenShareService.h>

@interface SampleHandler : RPBroadcastSampleHandler <ZoomVideoSDKScreenShareServiceDelegate>
@property(nonatomic, strong) ZoomVideoSDKScreenShareService *service;
@property(nonatomic, strong) CIContext *context;
@property(nonatomic) NSTimeInterval lastStatus;
@end
@implementation SampleHandler
- (instancetype)init {
  self = [super init];
  if (self) {
    ZoomVideoSDKScreenShareServiceInitParams *params = [ZoomVideoSDKScreenShareServiceInitParams new];
    params.appGroupId = @"group.com.heidisoft.iconicedu.classroom";
    params.isWithDeviceAudio = YES;
    self.service = [[ZoomVideoSDKScreenShareService alloc] initWithParams:params];
    self.service.delegate = self;
    self.context = [CIContext contextWithOptions:nil];
  }
  return self;
}
- (void)broadcastStartedWithSetupInfo:(NSDictionary<NSString *,NSObject *> *)setupInfo { [self.service broadcastStartedWithSetupInfo:setupInfo ?: @{}]; }
- (void)broadcastPaused { [self.service broadcastPaused]; }
- (void)broadcastResumed { [self.service broadcastResumed]; }
- (void)broadcastFinished { [self.service broadcastFinished]; }
- (void)processSampleBuffer:(CMSampleBufferRef)sampleBuffer withType:(RPSampleBufferType)type {
  if (type != RPSampleBufferTypeVideo) { [self.service processSampleBuffer:sampleBuffer withType:type]; return; }
  NSURL *root = [NSFileManager.defaultManager containerURLForSecurityApplicationGroupIdentifier:@"group.com.heidisoft.iconicedu.classroom"];
  NSURL *overlayURL = [root URLByAppendingPathComponent:@"classroom-overlay.png"];
  NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:overlayURL.path error:nil];
  NSTimeInterval now = NSDate.date.timeIntervalSince1970;
  CIImage *overlay = attributes && now - [attributes[NSFileModificationDate] timeIntervalSince1970] < 5 ? [CIImage imageWithContentsOfURL:overlayURL] : nil;
  CVPixelBufferRef input = CMSampleBufferGetImageBuffer(sampleBuffer);
  if (!overlay && self.lastStatus > 0) {
    [self finishBroadcastWithError:[NSError errorWithDomain:@"ClassroomComposition" code:1 userInfo:@{NSLocalizedDescriptionKey: @"Annotation publishing stopped. Return to the classroom and restart screen sharing."}]];
    return;
  }
  if (!overlay || !input) { [self.service processSampleBuffer:sampleBuffer withType:type]; return; }
  size_t width = CVPixelBufferGetWidth(input), height = CVPixelBufferGetHeight(input);
  CVPixelBufferRef output = nil;
  NSDictionary *options = @{(id)kCVPixelBufferIOSurfacePropertiesKey: @{}};
  CVReturn created = CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, (__bridge CFDictionaryRef)options, &output);
  if (created != kCVReturnSuccess || !output) { [self.service processSampleBuffer:sampleBuffer withType:type]; return; }
  CIImage *base = [CIImage imageWithCVPixelBuffer:input];
  CIImage *scaled = [overlay imageByApplyingTransform:CGAffineTransformMakeScale(width / overlay.extent.size.width, height / overlay.extent.size.height)];
  [self.context render:[scaled imageByCompositingOverImage:base] toCVPixelBuffer:output];
  CMVideoFormatDescriptionRef description = nil;
  CMSampleBufferRef composed = nil;
  CMSampleTimingInfo timing;
  CMSampleBufferGetSampleTimingInfo(sampleBuffer, 0, &timing);
  OSStatus result = CMVideoFormatDescriptionCreateForImageBuffer(kCFAllocatorDefault, output, &description);
  if (result == noErr) result = CMSampleBufferCreateReadyWithImageBuffer(kCFAllocatorDefault, output, description, &timing, &composed);
  if (result == noErr && composed) {
    CFDictionaryRef attachments = CMCopyDictionaryOfAttachments(kCFAllocatorDefault, sampleBuffer, kCMAttachmentMode_ShouldPropagate);
    if (attachments) { CMSetAttachments(composed, attachments, kCMAttachmentMode_ShouldPropagate); CFRelease(attachments); }
    [self.service processSampleBuffer:composed withType:type];
    if (now - self.lastStatus > 0.5) {
      self.lastStatus = now;
      [[NSString stringWithFormat:@"%.3f", now] writeToURL:[root URLByAppendingPathComponent:@"classroom-composition-frame"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
    }
  } else [self.service processSampleBuffer:sampleBuffer withType:type];
  if (composed) CFRelease(composed);
  if (description) CFRelease(description);
  CVPixelBufferRelease(output);
}
- (void)ZoomVideoSDKScreenShareServiceFinishBroadcastWithError:(NSError *)error { if (error) [self finishBroadcastWithError:error]; }
@end
