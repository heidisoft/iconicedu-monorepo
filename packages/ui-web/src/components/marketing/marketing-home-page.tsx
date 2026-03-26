import { MarketingFooterSection } from './marketing-footer-section';
import { MarketingHeroSection } from './marketing-hero-section';
import { MarketingHowItWorksSection } from './marketing-how-it-works-section';
import { MarketingSubjectsSection } from './marketing-subjects-section';
import { MarketingTrustStatsSection } from './marketing-trust-stats-section';

type MarketingHomePageProps = {
  loginHref?: string;
};

export function MarketingHomePage({
  loginHref = '/iconic-academy/login',
}: MarketingHomePageProps) {
  return (
    <div className="bg-background text-foreground">
      <MarketingHeroSection loginHref={loginHref} />
      <MarketingSubjectsSection />
      <MarketingTrustStatsSection />
      <MarketingHowItWorksSection loginHref={loginHref} />
      <MarketingFooterSection loginHref={loginHref} />
    </div>
  );
}
