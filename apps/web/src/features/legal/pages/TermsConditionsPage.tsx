import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsConditionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            to="/app/profile"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms and Conditions</h1>
        <p className="text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              By accessing or using WatchSphere, you agree to be bound by these Terms and Conditions. If you do not
              agree to these terms, please do not use our services. We reserve the right to modify these terms at
              any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. User Accounts</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              To access certain features, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Maintaining the confidentiality of your account</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete information</li>
              <li>Notifying us of any unauthorized access</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Marketplace Rules</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              When using our marketplace:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>All listings must be accurate and truthful</li>
              <li>You must have legal right to sell listed items</li>
              <li>Prices must be in good faith</li>
              <li>Counterfeits and stolen goods are strictly prohibited</li>
              <li>All transactions are between buyers and sellers</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Prohibited Activities</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Post false, misleading, or fraudulent content</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Attempt to gain unauthorized access</li>
              <li>Use the service for money laundering</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Transaction Terms</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>WatchSphere facilitates connections between buyers and sellers</li>
              <li>We are not a party to transactions between users</li>
              <li>Users are responsible for verifying authenticity</li>
              <li>Payment terms are agreed between parties</li>
              <li>We may charge service fees for certain transactions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p className="text-gray-600 leading-relaxed">
              All content, features, and functionality of WatchSphere are owned by us and are protected by
              international copyright, trademark, and other intellectual property laws. You may not reproduce,
              distribute, or create derivative works without our permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed">
              WatchSphere is provided "as is" without warranties of any kind. We shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages resulting from your use of the
              service. Our total liability shall not exceed the amount you paid us in the past 12 months.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Indemnification</h2>
            <p className="text-gray-600 leading-relaxed">
              You agree to indemnify and hold harmless WatchSphere and its officers, directors, employees, and
              agents from any claims, damages, losses, or expenses arising from your use of the service or violation
              of these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Termination</h2>
            <p className="text-gray-600 leading-relaxed">
              We may terminate or suspend your account at any time for any reason, including violation of these
              terms. Upon termination, your right to use the service will immediately cease. Provisions that by
              their nature should survive termination will survive.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Dispute Resolution</h2>
            <p className="text-gray-600 leading-relaxed">
              Any disputes arising from these terms shall be resolved through binding arbitration in accordance with
              the rules of the Swiss Arbitration Association. The arbitration shall take place in Zurich, Switzerland,
              and the language shall be English.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Governing Law</h2>
            <p className="text-gray-600 leading-relaxed">
              These terms shall be governed by and construed in accordance with the laws of Switzerland, without
              regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Information</h2>
            <p className="text-gray-600 leading-relaxed">
              For questions about these Terms and Conditions, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <p className="text-gray-700">Email: info@watchsphere.io</p>
              <p className="text-gray-700">Address: WatchSphere Inc., 123 Watch Street, Zurich, Switzerland</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
