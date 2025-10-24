import { useAuthStore } from '@watchsphere/shared/stores';

export function HomePage() {
  const user = useAuthStore((state) => state.user);

  const quickAccessButtons = [
    { title: 'Activity Center', subtitle: 'All your updates — matches, payments, shipping and alerts' },
    { title: 'Smart Search', subtitle: 'Find watches worldwide with intelligent filters and live matches' },
    { title: 'Buy', subtitle: 'Buy from verified dealers in your chosen market region' },
    { title: 'Sell', subtitle: 'List your watches for sale and connect with active buyers' },
    { title: 'Ask AI Assistant', subtitle: 'Your personal assistant, 24/7' },
    { title: 'My Inventory', subtitle: 'Manage, edit and track your full watch stock in real time', href: '/dashboard' },
    { title: 'My Orders', subtitle: 'View and manage all your active buy orders' },
    { title: 'Checks', subtitle: 'Avoid risk — check your serials and close deals confidently' },
    { title: 'All Tools', subtitle: 'Everything else you need — organized in one place' },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Welcome back, {user?.name}!</h1>
      <p className="text-gray-600 mb-8">Here's what's happening with your watches today.</p>

      <div className="grid gap-4 mb-8">
        {quickAccessButtons.map((btn, idx) => (
          <a
            key={idx}
            href={btn.href || '#'}
            className="card hover:shadow-md transition-shadow cursor-pointer"
          >
            <h3 className="text-lg font-semibold mb-1">{btn.title}</h3>
            <p className="text-sm text-gray-600">{btn.subtitle}</p>
          </a>
        ))}
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Latest from the Market</h2>
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded">
            📰 Patek increases Nautilus production by 5% — source: Bloomberg
          </div>
          <div className="p-3 bg-gray-50 rounded">
            📈 Submariner prices stabilize after -2.1% dip
          </div>
          <div className="p-3 bg-gray-50 rounded">
            🔧 Rolex service delays still affecting secondary market
          </div>
        </div>
      </div>
    </div>
  );
}
