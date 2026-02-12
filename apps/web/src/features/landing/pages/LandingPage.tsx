import { Construction } from 'lucide-react';
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
      {import.meta.env.DEV && (
        <div className="sticky top-0 z-[70] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 py-1.5 text-center text-sm font-semibold text-white shadow-md">
          <div className="flex items-center justify-center gap-2">
            <Construction className="h-4 w-4" />
            <span>Development Environment</span>
            <Construction className="h-4 w-4" />
          </div>
        </div>
      )}
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
