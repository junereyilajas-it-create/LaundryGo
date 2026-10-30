import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/ui';
import { 
  Users, Truck, Package, DollarSign, Clock, CheckCircle2, ListOrdered, FileText,
  TrendingUp, Activity, Bell, ShoppingBag, Droplets, Key, Shield, XCircle, Plus, Calendar
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ActivityLogModal from '../../components/common/ActivityLogModal';
import AddCustomerLaundryModal from '../../components/common/AddCustomerLaundryModal';
import TransactionFeedbackModal from '../../components/common/TransactionFeedbackModal';

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  service_type: string;
  current_status: string;
  created_at: string;
}

interface DashboardStats {
  totalCustomers: number;
  activeDrivers: number;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  readyForDelivery: number;
  completedOrders: number;
  revenue: number;
}

interface ActivityItem {
  id: number;
  actor_id?: number | null;
  actor_name: string;
  actor_role: string;
  action_type: string;
  description: string;
  entity_type?: string | null;
  entity_id?: string | null;
  outcome?: 'success' | 'failure';
  metadata?: any;
  created_at: string;
}

const STATUS_OPTIONS = [
  'Pending Request', 'Confirmed', 'Pickup Scheduled', 'Picked Up',
  'Laundry Received', 'Washing', 'Drying', 'Folding', 'Ready',
  'Out for Delivery', 'Delivered', 'Customer Pickup', 'Completed', 'Cancelled'
];

export default function WorkerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllActivities, setShowAllActivities] = useState(false);

  // Walk-in Laundry Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Transaction Feedback Modal State
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  const fetchData = async () => {
    try {
      const [ordersRes, statsRes, activitiesRes] = await Promise.allSettled([
        api.get('/orders'),
        api.get('/dashboard/stats'),
        api.get('/activities/recent?limit=15')
      ]);

      if (ordersRes.status === 'fulfilled') {
        setOrders(ordersRes.value.data || []);
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data || null);
      }

      if (activitiesRes.status === 'fulfilled') {
        const acts = Array.isArray(activitiesRes.value.data) 
          ? activitiesRes.value.data 
          : activitiesRes.value.data?.activities || [];
        setActivities(acts);
      } else {
        // Fallback to /dashboard/activity if /activities/recent was rejected
        try {
          const fallbackRes = await api.get('/dashboard/activity?limit=15');
          const fallbackActs = Array.isArray(fallbackRes.data) ? fallbackRes.data : [];
          setActivities(fallbackActs);
        } catch (e) {
          console.warn('Fallback activity retrieval note:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus, notes: 'Updated by worker' });
      fetchData();
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Status Updated',
        message: `Order status successfully updated to ${newStatus}.`
      });
    } catch (error: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Failed to Update Status',
        message: error.response?.data?.message || 'Error updating status'
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'Completed': return 'success';
      case 'Out for Delivery': return 'default';
      case 'Ready': return 'outline';
      case 'Cancelled': return 'error';
      default: return 'warning';
    }
  };

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-sm text-emerald-600 dark:text-emerald-400">
        <Clock className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium mt-2">Loading dashboard data...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* Top Action Bar with Add Customer Laundry button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg shadow-emerald-700/15">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">Shop Operations</span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Staff & Laundry Dashboard</h1>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            Monitor shop activities, real-time orders, and walk-in laundry services
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-3 rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Customer Laundry</span>
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Today's Revenue</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">₱{Number(stats.revenue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">From completed orders</p>
          </div>
          
          <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Total Customers</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalCustomers}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Active accounts</p>
          </div>
          
          <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Total Orders</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalOrders}</p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">{stats.completedOrders} completed</p>
          </div>

          <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <ListOrdered className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Active Laundry</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.processingOrders}</p>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">{stats.pendingOrders} pending pickups</p>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Activity Section */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    ({activities.length} latest)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fetchData()}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    title="Refresh activities"
                  >
                    Refresh
                  </button>
                  <button 
                    onClick={() => setShowAllActivities(true)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 font-medium transition-colors"
                  >
                    View All Activity →
                  </button>
                </div>
              </div>
              
              {activities.length === 0 ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-40 text-gray-400" />
                  <p className="text-sm font-medium">No recent activity logged yet.</p>
                  <p className="text-xs text-gray-400 mt-0.5">System operations will automatically appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                  {activities.slice(0, 15).map((activity, i) => {
                    const actionType = activity.action_type || '';
                    const isFailure = activity.outcome === 'failure';

                    const exactDate = new Date(activity.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });
                    const exactTime = new Date(activity.created_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });

                    // Format actor and entity display
                    const actorDisplay = activity.actor_name || 'System';
                    const entityDisplay = activity.entity_id 
                      ? (String(activity.entity_id).startsWith('LAU') ? activity.entity_id : `#${activity.entity_id}`)
                      : (activity.metadata?.order_number || null);

                    return (
                      <div 
                        key={activity.id || i} 
                        onClick={() => setShowAllActivities(true)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors cursor-pointer border border-gray-100 dark:border-gray-800/90 gap-2"
                      >
                        <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 sm:mt-0 ${
                            isFailure 
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                              : actionType.startsWith('auth_')
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                              : actionType.startsWith('pickup_') || actionType.startsWith('delivery_') || actionType.includes('driver')
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                              : actionType.startsWith('payment_')
                              ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600'
                              : actionType.includes('walk_in')
                              ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                          }`}>
                            {actionType.startsWith('auth_') ? <Key className="h-4 w-4" /> :
                             actionType.includes('walk_in') ? <ShoppingBag className="h-4 w-4" /> :
                             actionType.startsWith('pickup_') || actionType.startsWith('delivery_') || actionType.includes('driver') ? <Truck className="h-4 w-4" /> :
                             actionType.startsWith('payment_') ? <DollarSign className="h-4 w-4" /> :
                             actionType.startsWith('user_') ? <Shield className="h-4 w-4" /> :
                             isFailure ? <XCircle className="h-4 w-4" /> :
                             <Package className="h-4 w-4" />}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                {actorDisplay}
                              </span>
                              {activity.actor_role && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  activity.actor_role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                                  activity.actor_role === 'worker' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                  activity.actor_role === 'driver' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                }`}>
                                  {activity.actor_role}
                                </span>
                              )}
                              {entityDisplay && (
                                <span className="text-[10px] text-gray-500 font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                  {entityDisplay}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 font-medium mt-1 leading-snug">
                              {activity.description || `${activity.action_type}`}
                            </p>
                          </div>
                        </div>

                        {/* Exact Date & Time */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between text-[11px] text-gray-400 dark:text-gray-500 shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-gray-100 dark:border-gray-800">
                          <span className="font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400 inline" />
                            {exactDate}
                          </span>
                          <span className="flex items-center gap-1 text-gray-400">
                            <Clock className="w-3 h-3 text-gray-400 inline" />
                            {exactTime}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Auto-refreshing every 15s • Exact audit timestamps
              </span>
              <button 
                onClick={() => setShowAllActivities(true)}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 underline font-medium"
              >
                Open Audit History
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats & Popular Services */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Order Completion Rate</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {stats?.totalOrders ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats?.totalOrders ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Processing Rate</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {stats?.totalOrders ? Math.round(((stats.processingOrders + stats.readyForDelivery) / stats.totalOrders) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats?.totalOrders ? Math.round(((stats.processingOrders + stats.readyForDelivery) / stats.totalOrders) * 100) : 0}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Pending Rate</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {stats?.totalOrders ? Math.round((stats.pendingOrders / stats.totalOrders) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${stats?.totalOrders ? Math.round((stats.pendingOrders / stats.totalOrders) * 100) : 0}%` }}></div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Popular Services</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <Droplets className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Wash & Fold</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {orders.filter(o => o.service_type === 'shop_pickup' || o.service_type === 'customer_dropoff').length > 0 ? orders.length : 12}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                    <ShoppingBag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dry Cleaning</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  4
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                    <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ironing Only</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  2
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active Orders Overview</h3>
        </div>
        
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{order.order_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{order.customer_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 capitalize">{order.service_type.replace('_', ' ')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(order.current_status) as any}>
                        {order.current_status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        className="w-[180px] pl-3 pr-8 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-700 dark:text-gray-300"
                        value={order.current_status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Log Modal */}
      <ActivityLogModal 
        isOpen={showAllActivities} 
        onClose={() => setShowAllActivities(false)} 
      />

      {/* Walk-in / Drop-off Laundry Modal */}
      <AddCustomerLaundryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(result) => {
          fetchData();
          setFeedbackModal({
            isOpen: true,
            type: 'success',
            title: 'Laundry Transaction Added',
            message: `Walk-in laundry transaction ${result.order_number} successfully registered for ${result.customer_name}. Total: ₱${Number(result.total_amount).toFixed(2)} (${result.payment_status === 'paid' ? 'Paid' : 'Unpaid'}).`
          });
        }}
        onError={(errMsg) => {
          setFeedbackModal({
            isOpen: true,
            type: 'error',
            title: 'Transaction Error',
            message: errMsg || 'Failed to register laundry transaction.'
          });
        }}
      />

      {/* Transaction Success / Error Feedback Modal */}
      <TransactionFeedbackModal
        isOpen={feedbackModal.isOpen}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onClose={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
