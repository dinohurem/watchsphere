import { cn } from '@/lib/utils';
import {
  IconChartLine,
  IconWorld,
  IconShieldCheck,
  IconClockHour4,
  IconUsers,
  IconRobot,
  IconCurrencyDollar,
  IconHeart,
} from '@tabler/icons-react';

export function FeaturesSection() {
  const features = [
    {
      title: 'Real-Time Market Data',
      description:
        'Track watch prices across global markets with live updates and historical charts.',
      icon: <IconChartLine />,
    },
    {
      title: 'Global Marketplace',
      description:
        'Connect with verified dealers in US, EU, UAE, and Hong Kong markets.',
      icon: <IconWorld />,
    },
    {
      title: 'Verified Dealers',
      description:
        'Every dealer is vetted and verified for authenticity and reliability.',
      icon: <IconShieldCheck />,
    },
    {
      title: '24/7 Trading',
      description: 'Place orders anytime. Our marketplace never sleeps.',
      icon: <IconClockHour4 />,
    },
    {
      title: 'Community Driven',
      description:
        'Join thousands of watch enthusiasts sharing insights and opportunities.',
      icon: <IconUsers />,
    },
    {
      title: 'AI-Powered Insights',
      description:
        'Get personalized recommendations and market analysis from our AI assistant.',
      icon: <IconRobot />,
    },
    {
      title: 'Transparent Pricing',
      description:
        'See bid/ask spreads and historical prices for informed decisions.',
      icon: <IconCurrencyDollar />,
    },
    {
      title: 'Watchlist Alerts',
      description:
        'Get notified when your favorite watches hit your target price.',
      icon: <IconHeart />,
    },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Trade Watches
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Powerful features designed for serious collectors and dealers.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10">
          {features.map((feature, index) => (
            <Feature key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        'flex flex-col lg:border-r py-10 relative group/feature border-gray-200',
        (index === 0 || index === 4) && 'lg:border-l border-gray-200',
        index < 4 && 'lg:border-b border-gray-200'
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-gray-100 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-gray-100 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-gray-600">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-gray-300 group-hover/feature:bg-primary transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-gray-800">
          {title}
        </span>
      </div>
      <p className="text-sm text-gray-600 max-w-xs relative z-10 px-10">
        {description}
      </p>
    </div>
  );
};
