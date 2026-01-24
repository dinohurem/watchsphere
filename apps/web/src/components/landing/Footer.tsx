import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
  e.preventDefault();
  const element = document.querySelector(href);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <img
              src="/logo.svg"
              alt="WatchSphere"
              className="h-8 w-auto mb-4 brightness-0 invert"
            />
            <p className="text-gray-400 text-sm">
              {t('landing.footer.about')}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t('landing.footer.product')}</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a
                  href="#features"
                  onClick={(e) => scrollToSection(e, '#features')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t('nav.features')}
                </a>
              </li>
              <li>
                <a
                  href="#markets"
                  onClick={(e) => scrollToSection(e, '#markets')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t('nav.markets')}
                </a>
              </li>
              <li>
                <a
                  href="#timeline"
                  onClick={(e) => scrollToSection(e, '#timeline')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t('nav.howItWorks')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t('landing.footer.company')}</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  {t('landing.footer.aboutUs')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  {t('landing.footer.careers')}
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  onClick={(e) => scrollToSection(e, '#contact')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t('landing.footer.contact')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t('landing.footer.legal')}</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  {t('landing.footer.privacyPolicy')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  {t('landing.footer.termsOfService')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  {t('landing.footer.cookiePolicy')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            {t('landing.footer.copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex gap-6">
            <Link
              to="/login"
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              to="/register"
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              {t('nav.signUp')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
