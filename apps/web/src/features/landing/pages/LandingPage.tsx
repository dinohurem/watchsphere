import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { HowItWorksTimeline } from '@/components/landing/Timeline';
import { GlobalMarketsSection } from '@/components/landing/WorldMap';
import { TestimonialsSection } from '@/components/landing/Testimonials';
import { CallToActionSection } from '@/components/landing/CallToAction';
import { ContactSection } from '@/components/landing/ContactSection';
import { Footer } from '@/components/landing/Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksTimeline />
      <GlobalMarketsSection />
      <TestimonialsSection />
      <CallToActionSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
