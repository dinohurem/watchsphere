'use client';

import {
  useScroll,
  useTransform,
  motion,
} from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

export function Timeline({ data }: { data: TimelineEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 10%', 'end 50%'],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div
      className="w-full bg-white font-sans md:px-10"
      ref={containerRef}
    >
      <div className="max-w-7xl mx-auto py-20 px-4 md:px-8 lg:px-10">
        <h2 className="text-lg md:text-4xl mb-4 text-gray-900 max-w-4xl font-bold">
          How WatchSphere Works
        </h2>
        <p className="text-gray-600 text-sm md:text-base max-w-sm">
          From browsing to buying, here's your journey with WatchSphere.
        </p>
      </div>

      <div ref={ref} className="relative max-w-7xl mx-auto pb-20">
        {data.map((item, index) => (
          <div
            key={index}
            className="flex justify-start pt-10 md:pt-40 md:gap-10"
          >
            <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
              <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-white flex items-center justify-center">
                <div className="h-4 w-4 rounded-full bg-gray-200 border border-gray-300 p-2" />
              </div>
              <h3 className="hidden md:block text-xl md:pl-20 md:text-5xl font-bold text-gray-500">
                {item.title}
              </h3>
            </div>

            <div className="relative pl-20 pr-4 md:pl-4 w-full">
              <h3 className="md:hidden block text-2xl mb-4 text-left font-bold text-gray-500">
                {item.title}
              </h3>
              {item.content}
            </div>
          </div>
        ))}
        <div
          style={{
            height: height + 'px',
          }}
          className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-gray-200 to-transparent to-[99%] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
        >
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className="absolute inset-x-0 top-0 w-[2px] bg-gradient-to-b from-violet-500 via-blue-500 to-cyan-400 rounded-full"
          />
        </div>
      </div>
    </div>
  );
}

export function HowItWorksTimeline() {
  const timelineData = [
    {
      title: 'Step 1',
      content: (
        <div>
          <h4 className="text-xl font-semibold text-gray-900 mb-4">
            Create Your Account
          </h4>
          <p className="text-gray-600 mb-6">
            Sign up in seconds with your email. Verify your identity to unlock
            full trading features and connect with verified dealers worldwide.
          </p>
          <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center">
            <span className="text-4xl">👤</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Step 2',
      content: (
        <div>
          <h4 className="text-xl font-semibold text-gray-900 mb-4">
            Browse the Market
          </h4>
          <p className="text-gray-600 mb-6">
            Explore thousands of luxury watches from brands like Rolex, Patek
            Philippe, and Audemars Piguet. Filter by brand, condition, year, and
            location.
          </p>
          <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center">
            <span className="text-4xl">🔍</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Step 3',
      content: (
        <div>
          <h4 className="text-xl font-semibold text-gray-900 mb-4">
            Place Your Order
          </h4>
          <p className="text-gray-600 mb-6">
            Found the perfect watch? Place a buy order at your price or accept
            an existing ask. Our order book ensures transparent, fair pricing.
          </p>
          <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center">
            <span className="text-4xl">💰</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Step 4',
      content: (
        <div>
          <h4 className="text-xl font-semibold text-gray-900 mb-4">
            Secure Transaction
          </h4>
          <p className="text-gray-600 mb-6">
            Complete your purchase through our secure escrow system. We handle
            authentication, payment, and delivery so you can buy with
            confidence.
          </p>
          <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center">
            <span className="text-4xl">✅</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="timeline">
      <Timeline data={timelineData} />
    </section>
  );
}
