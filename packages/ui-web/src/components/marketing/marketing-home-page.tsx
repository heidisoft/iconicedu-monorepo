import { MarketingFooterSection } from './marketing-footer-section';
import { MarketingHeroSection } from './marketing-hero-section';
import { MarketingHowItWorksSection } from './marketing-how-it-works-section';
import { MarketingSubjectsSection } from './marketing-subjects-section';
import { MarketingTrustStatsSection } from './marketing-trust-stats-section';

export function MarketingHomePage() {
  return (
    <div className="bg-background text-foreground">
      <MarketingHeroSection />
      <MarketingSubjectsSection />
      <MarketingTrustStatsSection />
      <MarketingHowItWorksSection />
      <MarketingFooterSection />
    </div>
  );
}
