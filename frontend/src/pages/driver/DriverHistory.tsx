import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { History, Search, Calendar, CheckCircle } from 'lucide-react';

interface Task {
  id: number;
  type: 'pickup' | 'delivery';
  order_number: string;
  customer_name: string;
  address: string;
  status: string;
  created_at: string;
}

export default function DriverHistory() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const [pRes, dRes] = await Promise.all([
        api.get('/logistics/pickups'),
        api.get('/logistics/deliveries')
      ]);
      
      const pickups = pRes.data
        .filter((p: any) => p.status === 'picked_up' || p.status === 'cancelled')
        .map((p: any) => ({ ...p, type: 'pickup' }));
        
      const deliveries = dRes.data
        .filter((d: any) => d.status === 'delivered' || d.status === 'cancelled')
        .map((d: any) => ({ ...d, type: 'delivery' }));
        
      // Sort by created_at desc
      const combined = [...pickups, ...deliveries].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
        
      setTasks(combined);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredTasks = tasks.filter(task => 
    task.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    task.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <History className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Task History
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Review your completed pickups and deliveries</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by Order # or Customer..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400">
                <th className="p-4">Type</th>
                <th className="p-4">Order #</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">Loading history...</td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">No history found.</td>
                </tr>
              ) : (
                filteredTasks.map(task => (
                  <tr key={`${task.type}-${task.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${task.type === 'pickup' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {task.type}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{task.order_number}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">{task.customer_name}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(task.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 w-max ${task.status.includes('cancelled') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {task.status.includes('cancelled') ? null : <CheckCircle className="h-3 w-3" />}
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
