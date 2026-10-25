import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { 
  Clock, CheckCircle2, Truck, Package, XCircle, Plus, 
  DollarSign, ArrowRight, Navigation, Sparkles, MessageSquare 
} from 'lucide-react';
import { Badge, Button } from '../../components/ui';
import RequestServiceModal from '../../components/common/RequestServiceModal';

interface Order {
  id: number;
  order_number: string;
  service_type: string;
  service_name?: string;
  status: string;
  payment_status: string;
  created_at: string;
  total_amount: number;
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await api.get('/orders');
      setOrders(data);
    } catch (error) {
      console.error('Error fetching dashboard orders:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
      case 'Delivered':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'Out for Delivery':
      case 'Pickup Scheduled':
        return <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'Ready':
        return <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case 'Cancelled':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Completed':
      case 'Delivered':
        return 'success';
      case 'Out for Delivery':
      case 'Pickup Scheduled':
        return 'default';
      case 'Ready':
        return 'outline';
      case 'Cancelled':
        return 'error';
      default:
        return 'warning';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400">
          <Clock className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading your laundry overview...</p>
        </div>
      </div>
    );
  }

  const completedOrders = orders.filter((o) => o.status === 'Completed' || o.status === 'Delivered').length;
  const activeOrders = orders.filter((o) => o.status !== 'Completed' && o.status !== 'Delivered' && o.status !== 'Cancelled').length;
  const totalSpent = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Customer Overview
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Welcome to LaundriGo • Poblacion, Lagonglong, Misamis Oriental
          </p>
        </div>

        <Button
          onClick={() => setIsRequestModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Request Laundry Service
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <h3 className="font-medium text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Active Laundry
          </h3>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{activeOrders}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">Orders in process</p>
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
          <h3 className="font-medium text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Completed Orders
          </h3>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{completedOrders}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Delivered & finished</p>
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
          <h3 className="font-medium text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Total Spent
          </h3>
          <p className="text-3xl font-black text-gray-900 dark:text-white">₱{totalSpent.toFixed(2)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">Paid orders</p>
        </div>
      </div>

      {/* Quick Action Shortcuts Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div 
          onClick={() => navigate('/customer/tracking')}
          className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base">Live Driver GPS Tracking</h4>
              <p className="text-xs text-blue-100">See your driver location in Poblacion, Lagonglong</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 shrink-0" />
        </div>

        <div 
          onClick={() => navigate('/customer/orders')}
          className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-gray-900 dark:text-white">View "My Laundry"</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Order stages, cancellation & chat</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
        </div>
      </div>

      {/* Recent Orders Table / Card List */}
      <div className="p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Recent Laundry Requests</h3>
          <Link to="/customer/orders" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            View All in My Laundry →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No laundry requests placed yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                    {getStatusIcon(order.status)}
                  </div>
                  <div>
                    <span className="font-mono font-bold text-gray-900 dark:text-white block">
                      {order.order_number}
                    </span>
                    <span className="text-xs text-gray-500">
                      {order.service_name || order.service_type}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 dark:text-white hidden sm:inline">
                    ₱{parseFloat(String(order.total_amount || 0)).toFixed(2)}
                  </span>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service Request Modal */}
      <RequestServiceModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onOrderCreated={() => fetchOrders()}
      />

    </div>
  );
}
