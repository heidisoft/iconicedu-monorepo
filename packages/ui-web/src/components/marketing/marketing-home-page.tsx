import { MarketingFaqSection } from './marketing-faq-section';
import { MarketingHeroSection } from './marketing-hero-section';
import { MarketingHowItWorksSection } from './marketing-how-it-works-section';
import { MarketingLowFrictionStartSection } from './marketing-low-friction-start-section';
import { MarketingMissionSection } from './marketing-mission-section';
import { MarketingMobileAppSection } from './marketing-mobile-app-section';
import { MarketingSuccessPathSection } from './marketing-success-path-section';
import { MarketingSubjectsSection } from './marketing-subjects-section';
import { MarketingTrustStatsSection } from './marketing-trust-stats-section';
import { MarketingUsCurriculumSection } from './marketing-us-curriculum-section';

type MarketingHomePageProps = {
  loginHref?: string;
};

export function MarketingHomePage({
  loginHref = '/iconic-academy/get-started',
}: MarketingHomePageProps) {
  return (
    <div className="bg-background text-foreground">
      <MarketingHeroSection loginHref={loginHref} />
      <MarketingSubjectsSection />
      <MarketingTrustStatsSection />
      <MarketingHowItWorksSection loginHref={loginHref} />
      <MarketingLowFrictionStartSection loginHref={loginHref} />
      <MarketingUsCurriculumSection />
      <MarketingSuccessPathSection />
      <MarketingMobileAppSection />
      <MarketingMissionSection />
      <MarketingFaqSection />
    </div>
  );
}
