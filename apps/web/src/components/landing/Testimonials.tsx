'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Testimonial {
  quote: string;
  name: string;
  title: string;
  avatar?: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "WatchSphere has completely transformed how I buy and sell watches. The transparency and global reach are unmatched.",
    name: "Marcus Chen",
    title: "Watch Collector, Hong Kong",
  },
  {
    quote:
      "As a dealer, I've expanded my business internationally thanks to WatchSphere. The platform connects me with serious buyers worldwide.",
    name: "Sophie Laurent",
    title: "Luxury Watch Dealer, Paris",
  },
  {
    quote:
      "The real-time market data helps me make informed decisions. I've never felt more confident buying pre-owned luxury watches.",
    name: "James Mitchell",
    title: "Investor, New York",
  },
  {
    quote:
      "Finally, a platform that understands the watch community. The verification process gives me peace of mind on every transaction.",
    name: "Alexandra Weber",
    title: "Watch Enthusiast, Zurich",
  },
  {
    quote:
      "The order book feature is brilliant. I can see exactly where the market is moving and time my purchases perfectly.",
    name: "David Kim",
    title: "Private Collector, Singapore",
  },
  {
    quote:
      "WatchSphere's AI assistant helped me identify the perfect Rolex for my collection. The technology is impressive.",
    name: "Michael Torres",
    title: "Watch Collector, Miami",
  },
];

// Split testimonials into columns with offset for misalignment
const column1 = [testimonials[0], testimonials[3]];
const column2 = [testimonials[1], testimonials[4]];
const column3 = [testimonials[2], testimonials[5]];

export function TestimonialsSection() {
  const scrollRef1 = useRef<HTMLDivElement>(null);
  const scrollRef2 = useRef<HTMLDivElement>(null);
  const scrollRef3 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animate = () => {
      [scrollRef1, scrollRef2, scrollRef3].forEach((ref, idx) => {
        if (ref.current) {
          const direction = idx % 2 === 0 ? 1 : -1;
          const speed = 0.3;
          ref.current.scrollTop += speed * direction;

          // Reset scroll when reaching end
          if (direction > 0 && ref.current.scrollTop >= ref.current.scrollHeight - ref.current.clientHeight) {
            ref.current.scrollTop = 0;
          } else if (direction < 0 && ref.current.scrollTop <= 0) {
            ref.current.scrollTop = ref.current.scrollHeight - ref.current.clientHeight;
          }
        }
      });
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <section className="py-20 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Trusted by Collectors Worldwide
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join thousands of watch enthusiasts and dealers who trust WatchSphere
            for their luxury watch transactions.
          </p>
        </div>

        <div className="relative">
          {/* Top fade gradient */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-gray-50 to-transparent z-10 pointer-events-none" />

          {/* Bottom fade gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 to-transparent z-10 pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-[500px]">
            {/* Column 1 - scrolls down */}
            <div
              ref={scrollRef1}
              className="overflow-hidden space-y-6 pt-0"
              style={{ scrollBehavior: 'smooth' }}
            >
              {[...column1, ...column1, ...column1].map((testimonial, index) => (
                <TestimonialCard key={`c1-${index}`} testimonial={testimonial} />
              ))}
            </div>

            {/* Column 2 - scrolls up, offset */}
            <div
              ref={scrollRef2}
              className="overflow-hidden space-y-6 pt-12"
              style={{ scrollBehavior: 'smooth' }}
            >
              {[...column2, ...column2, ...column2].map((testimonial, index) => (
                <TestimonialCard key={`c2-${index}`} testimonial={testimonial} />
              ))}
            </div>

            {/* Column 3 - scrolls down, more offset */}
            <div
              ref={scrollRef3}
              className="overflow-hidden space-y-6 pt-6 hidden lg:block"
              style={{ scrollBehavior: 'smooth' }}
            >
              {[...column3, ...column3, ...column3].map((testimonial, index) => (
                <TestimonialCard key={`c3-${index}`} testimonial={testimonial} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl p-6 border border-gray-100 shadow-sm",
        "hover:shadow-md transition-shadow duration-300"
      )}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
          {testimonial.name.charAt(0)}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
          <p className="text-sm text-gray-500">{testimonial.title}</p>
        </div>
      </div>
      <blockquote className="text-gray-700 leading-relaxed">
        "{testimonial.quote}"
      </blockquote>
      <div className="mt-4 flex gap-1">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className="w-4 h-4 text-yellow-400 fill-current"
            viewBox="0 0 20 20"
          >
            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
          </svg>
        ))}
      </div>
    </div>
  );
}
