import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export function DashboardPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [inventoryRes, statsRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/stats'),
      ]);
      setInventory(inventoryRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">My Inventory</h1>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <p className="text-sm text-gray-600">Total Watches</p>
            <p className="text-3xl font-bold">{stats.total_watches}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-3xl font-bold">${stats.total_value.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Conditions</p>
            <div className="text-sm mt-2">
              <div>New: {stats.by_condition.new}</div>
              <div>Excellent: {stats.by_condition.excellent}</div>
              <div>Good: {stats.by_condition.good}</div>
            </div>
          </div>
        </div>
      )}

      {inventory.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Your inventory is empty. Start by adding watches!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {inventory.map((watch) => (
            <div key={watch.id} className="card">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{watch.brand} {watch.model}</h3>
                  <p className="text-lg font-bold text-primary mt-1">${watch.price.toLocaleString()}</p>
                  <p className="text-sm text-gray-600 mt-1">Condition: {watch.condition}</p>
                </div>
                <button className="btn-primary text-sm">Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
