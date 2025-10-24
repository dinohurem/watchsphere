import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Package, DollarSign, TrendingUp, Plus, Edit, Trash2 } from 'lucide-react';

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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Inventory</h1>
            <p className="text-gray-600">Manage and track your watch collection</p>
          </div>
          <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg flex items-center gap-2 transition-colors">
            <Plus className="w-5 h-5" />
            Add Watch
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Watches</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_watches}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${stats.total_value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Average Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${stats.total_watches > 0 ? Math.round(stats.total_value / stats.total_watches).toLocaleString() : 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-3">By Condition</p>
                <div className="space-y-2">
                  {stats.by_condition.new > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">New</span>
                      <span className="font-semibold text-gray-900">{stats.by_condition.new}</span>
                    </div>
                  )}
                  {stats.by_condition.excellent > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Excellent</span>
                      <span className="font-semibold text-gray-900">{stats.by_condition.excellent}</span>
                    </div>
                  )}
                  {stats.by_condition.good > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Good</span>
                      <span className="font-semibold text-gray-900">{stats.by_condition.good}</span>
                    </div>
                  )}
                  {stats.by_condition.fair > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fair</span>
                      <span className="font-semibold text-gray-900">{stats.by_condition.fair}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inventory List */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your Watches</h2>
          </div>

          {inventory.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Your inventory is empty</p>
              <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors">
                Add Your First Watch
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {inventory.map((watch) => (
                <div
                  key={watch.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-6">
                    {/* Watch Image Placeholder */}
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-3xl">⌚</span>
                    </div>

                    {/* Watch Info */}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {watch.brand} {watch.model}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 mt-2">
                        <span className="text-xl font-bold text-primary">
                          ${watch.price.toLocaleString()}
                        </span>
                        <span className="capitalize px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                          {watch.condition}
                        </span>
                        {watch.year && (
                          <span className="text-sm text-gray-600">
                            Year: {watch.year}
                          </span>
                        )}
                        {watch.serial_number && (
                          <span className="text-sm text-gray-600">
                            S/N: {watch.serial_number}
                          </span>
                        )}
                      </div>
                      {watch.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {watch.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                        <Edit className="w-5 h-5 text-gray-600" />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
