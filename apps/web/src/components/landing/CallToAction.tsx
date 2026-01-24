import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CallToActionSection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gray-100 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-100 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          {t('landing.cta.title')}
        </h2>
        <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          {t('landing.cta.description')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            asChild
            size="lg"
            className="bg-gray-900 text-white hover:bg-gray-800 rounded-xl px-8 py-6 text-lg font-semibold"
          >
            <Link to="/register">
              {t('landing.cta.button')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-gray-900 text-gray-900 hover:bg-gray-100 rounded-xl px-8 py-6 text-lg"
          >
            <Link to="/login">{t('nav.signIn')}</Link>
          </Button>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          {t('landing.cta.noCreditCard')}
        </p>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
          <div>
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">10K+</div>
            <div className="text-gray-500 mt-1 text-xs sm:text-sm">{t('landing.cta.stats.users').replace('10K+ ', '')}</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">$50M+</div>
            <div className="text-gray-500 mt-1 text-xs sm:text-sm">{t('landing.cta.stats.volume').replace('$50M+ ', '')}</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">50+</div>
            <div className="text-gray-500 mt-1 text-xs sm:text-sm">{t('landing.cta.stats.countries').replace('50+ ', '')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
