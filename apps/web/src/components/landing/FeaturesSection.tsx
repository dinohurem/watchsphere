import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  const features = [
    {
      title: t('landing.features.realTimeData.title'),
      description: t('landing.features.realTimeData.description'),
      icon: <IconChartLine />,
    },
    {
      title: t('landing.features.globalMarketplace.title'),
      description: t('landing.features.globalMarketplace.description'),
      icon: <IconWorld />,
    },
    {
      title: t('landing.features.verifiedDealers.title'),
      description: t('landing.features.verifiedDealers.description'),
      icon: <IconShieldCheck />,
    },
    {
      title: t('landing.features.trading247.title'),
      description: t('landing.features.trading247.description'),
      icon: <IconClockHour4 />,
    },
    {
      title: t('landing.features.communityDriven.title'),
      description: t('landing.features.communityDriven.description'),
      icon: <IconUsers />,
    },
    {
      title: t('landing.features.aiPowered.title'),
      description: t('landing.features.aiPowered.description'),
      icon: <IconRobot />,
    },
    {
      title: t('landing.features.transparentPricing.title'),
      description: t('landing.features.transparentPricing.description'),
      icon: <IconCurrencyDollar />,
    },
    {
      title: t('landing.features.watchlistAlerts.title'),
      description: t('landing.features.watchlistAlerts.description'),
      icon: <IconHeart />,
    },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('landing.features.title')}
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            {t('landing.features.description')}
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
