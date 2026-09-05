import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '../../components/ui';
import { Users, Truck, Package, DollarSign, Clock, CheckCircle2, ListOrdered, FileText } from 'lucide-react';

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

const STATUS_OPTIONS = [
  'Pending Request', 'Confirmed', 'Pickup Scheduled', 'Picked Up',
  'Laundry Received', 'Washing', 'Drying', 'Folding', 'Ready',
  'Out for Delivery', 'Delivered', 'Customer Pickup', 'Completed', 'Cancelled'
];

export default function WorkerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/dashboard/stats')
      ]);
      setOrders(ordersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus, notes: 'Updated by worker' });
      fetchData();
    } catch (error) {
      alert('Error updating status');
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
      <div className="animate-pulse flex flex-col items-center gap-sm text-primary">
        <Clock className="w-8 h-8 animate-spin" />
        <p className="font-label-md text-label-md">Loading admin dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-lg max-w-[1400px] mx-auto pb-xl">
      <div>
        <h1 className="font-h1 text-h1 text-primary dark:text-primary-fixed-dim">Admin / Worker Dashboard</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Overview and management</p>
      </div>
      
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md sm:gap-lg">
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-lg flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary">Total Customers</p>
                <h3 className="font-h1 text-h1 text-on-surface mt-xs">{stats.totalCustomers}</h3>
              </div>
              <div className="bg-primary-container text-on-primary p-sm rounded-lg">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-lg flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary">Active Drivers</p>
                <h3 className="font-h1 text-h1 text-on-surface mt-xs">{stats.activeDrivers}</h3>
              </div>
              <div className="bg-[#e0e7ff] text-[#4338ca] dark:bg-indigo-900/40 dark:text-indigo-400 p-sm rounded-lg">
                <Truck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-lg flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary">Total Orders</p>
                <h3 className="font-h1 text-h1 text-on-surface mt-xs">{stats.totalOrders}</h3>
              </div>
              <div className="bg-[#f3e8ff] text-[#7e22ce] dark:bg-purple-900/40 dark:text-purple-400 p-sm rounded-lg">
                <Package className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-lg flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary">Total Revenue</p>
                <h3 className="font-h1 text-[24px] font-bold text-on-surface mt-xs">₱{Number(stats.revenue).toLocaleString('en-US', {minimumFractionDigits: 2})}</h3>
              </div>
              <div className="bg-[#dcfce7] text-[#15803d] dark:bg-green-900/40 dark:text-green-400 p-sm rounded-lg">
                <DollarSign className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-lg flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary">Pending Orders</p>
                <h3 className="font-h1 text-h1 text-on-surface mt-xs">{stats.pendingOrders}</h3>
              </div>
              <div className="bg-[#fef9c3] text-[#a16207] dark:bg-yellow-900/40 dark:text-yellow-400 p-sm rounded-lg">
                <ListOrdered className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-lg flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary">Processing</p>
                <h3 className="font-h1 text-h1 text-on-surface mt-xs">{stats.processingOrders}</h3>
              </div>
              <div className="bg-surface-variant text-primary p-sm rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-lg flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary">Ready for Delivery</p>
                <h3 className="font-h1 text-h1 text-on-surface mt-xs">{stats.readyForDelivery}</h3>
              </div>
              <div className="bg-secondary-container text-on-secondary-container p-sm rounded-lg">
                <Truck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-lg flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-secondary">Completed</p>
                <h3 className="font-h1 text-h1 text-on-surface mt-xs">{stats.completedOrders}</h3>
              </div>
              <div className="bg-[#dcfce7] text-[#15803d] dark:bg-green-900/40 dark:text-green-400 p-sm rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-outline-variant/10 dark:border-outline/10 p-md sm:p-lg">
          <CardTitle className="flex items-center gap-sm text-[18px]">
            <FileText className="w-5 h-5 text-primary" />
            All Orders
          </CardTitle>
        </CardHeader>
        
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="min-w-full divide-y divide-outline-variant/10 dark:divide-outline/10">
            <thead className="bg-surface-container-low dark:bg-surface-container">
              <tr>
                <th className="px-md sm:px-lg py-sm text-left font-label-md text-label-md text-secondary uppercase">Order</th>
                <th className="px-md sm:px-lg py-sm text-left font-label-md text-label-md text-secondary uppercase">Customer</th>
                <th className="px-md sm:px-lg py-sm text-left font-label-md text-label-md text-secondary uppercase">Service</th>
                <th className="px-md sm:px-lg py-sm text-left font-label-md text-label-md text-secondary uppercase">Date</th>
                <th className="px-md sm:px-lg py-sm text-left font-label-md text-label-md text-secondary uppercase">Status</th>
                <th className="px-md sm:px-lg py-sm text-left font-label-md text-label-md text-secondary uppercase">Update Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-container-lowest divide-y divide-outline-variant/10 dark:divide-outline/10">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-surface-bright dark:hover:bg-surface-container/50 transition-colors">
                  <td className="px-md sm:px-lg py-md whitespace-nowrap font-label-md text-[14px] text-on-surface">{order.order_number}</td>
                  <td className="px-md sm:px-lg py-md whitespace-nowrap font-body-sm text-on-surface-variant">{order.customer_name}</td>
                  <td className="px-md sm:px-lg py-md whitespace-nowrap font-body-sm text-on-surface-variant">{order.service_type}</td>
                  <td className="px-md sm:px-lg py-md whitespace-nowrap font-body-sm text-on-surface-variant">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-md sm:px-lg py-md whitespace-nowrap">
                    <Badge variant={getStatusBadgeVariant(order.current_status) as any}>
                      {order.current_status}
                    </Badge>
                  </td>
                  <td className="px-md sm:px-lg py-md whitespace-nowrap text-sm text-gray-500">
                    <div className="relative w-[180px]">
                      <select
                        className="w-full pl-sm pr-lg py-xs bg-surface-container-low dark:bg-surface-container-highest border border-outline-variant/50 rounded-md focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all font-body-sm text-body-sm text-on-surface appearance-none"
                        value={order.current_status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-sm text-outline">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
