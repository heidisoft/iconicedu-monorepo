#import <ReplayKit/ReplayKit.h>
#import <ZoomVideoSDKScreenShare/ZoomVideoSDKScreenShareService.h>

@interface SampleHandler : RPBroadcastSampleHandler <ZoomVideoSDKScreenShareServiceDelegate>
@property(nonatomic, strong) ZoomVideoSDKScreenShareService *service;
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
  }
  return self;
}
- (void)broadcastStartedWithSetupInfo:(NSDictionary<NSString *,NSObject *> *)setupInfo { [self.service broadcastStartedWithSetupInfo:setupInfo ?: @{}]; }
- (void)broadcastPaused { [self.service broadcastPaused]; }
- (void)broadcastResumed { [self.service broadcastResumed]; }
- (void)broadcastFinished { [self.service broadcastFinished]; }
- (void)processSampleBuffer:(CMSampleBufferRef)sampleBuffer withType:(RPSampleBufferType)type { [self.service processSampleBuffer:sampleBuffer withType:type]; }
- (void)ZoomVideoSDKScreenShareServiceFinishBroadcastWithError:(NSError *)error { if (error) [self finishBroadcastWithError:error]; }
@end
