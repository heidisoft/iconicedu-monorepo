import fs from 'node:fs';
import path from 'node:path';

const PURPOSE_STRINGS = {
  NSCameraUsageDescription:
    'ICONIC Academy uses your camera when you choose classroom video or take a photo, for example to join a live class or attach an image to a message.',
  NSFaceIDUsageDescription:
    'ICONIC Academy uses Face ID only when you choose biometric access, for example to unlock your saved app session more securely.',
  NSLocationWhenInUseUsageDescription:
    'ICONIC Academy uses your location during onboarding to detect your time zone and city, region, and country; for example, this helps show class times in your local time zone.',
  NSMicrophoneUsageDescription:
    'ICONIC Academy uses your microphone when you choose classroom audio or record a voice message, for example to speak during a live class.',
  NSPhotoLibraryAddUsageDescription:
    'ICONIC Academy saves images to your photo library only when you choose to save a message image, for example keeping a class attachment for later.',
  NSPhotoLibraryUsageDescription:
    'ICONIC Academy uses your photo library only when you choose an image, for example to attach a photo to a class or direct message.',
} as const;

describe('iOS purpose strings', () => {
  it('uses review-ready purpose strings in Expo config', () => {
    const appJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf8'),
    ) as {
      expo?: {
        ios?: {
          infoPlist?: Record<string, string>;
        };
      };
    };

    expect(appJson.expo?.ios?.infoPlist).toMatchObject(PURPOSE_STRINGS);
  });

  it('uses review-ready purpose strings in the native Info.plist', () => {
    const plist = fs.readFileSync(
      path.join(process.cwd(), 'ios/ICONICAcademy/Info.plist'),
      'utf8',
    );

    Object.entries(PURPOSE_STRINGS).forEach(([key, value]) => {
      expect(plist).toContain(`<key>${key}</key>\n    <string>${value}</string>`);
    });
    expect(plist).not.toContain('NSLocationAlwaysUsageDescription');
    expect(plist).not.toContain('NSLocationAlwaysAndWhenInUseUsageDescription');
  });
});
