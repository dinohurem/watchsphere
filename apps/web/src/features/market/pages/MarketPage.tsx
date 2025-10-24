import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export function MarketPage() {
  const [watches, setWatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatches();
  }, []);

  const loadWatches = async () => {
    try {
      const response = await api.get('/market');
      setWatches(response.data);
    } catch (error) {
      console.error('Failed to load watches:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Market</h1>

      {watches.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">No watches listed yet. Be the first to list one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watches.map((watch) => (
            <div key={watch.id} className="card">
              <h3 className="text-xl font-semibold">{watch.brand} {watch.model}</h3>
              <p className="text-2xl font-bold text-primary mt-2">${watch.price.toLocaleString()}</p>
              <p className="text-sm text-gray-600 mt-2">Condition: {watch.condition}</p>
              {watch.year && <p className="text-sm text-gray-600">Year: {watch.year}</p>}
              <p className="text-sm text-gray-600 mt-2">Dealer: {watch.dealer.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
