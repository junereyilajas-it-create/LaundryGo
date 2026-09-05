import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Card, CardHeader, CardTitle, Badge } from '../../components/ui';
import { Truck, MapPin, Phone, Calendar, Clock, Navigation, Package } from 'lucide-react';

interface LogisticsTask {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
}

export default function DriverDashboard() {
  const [pickups, setPickups] = useState<LogisticsTask[]>([]);
  const [deliveries, setDeliveries] = useState<LogisticsTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [pickupRes, deliveryRes] = await Promise.all([
        api.get('/logistics/pickups'),
        api.get('/logistics/deliveries')
      ]);
      setPickups(pickupRes.data);
      setDeliveries(deliveryRes.data);
    } catch (error) {
      console.error('Error fetching logistics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updatePickupStatus = async (id: number, status: string) => {
    try {
      await api.put(`/logistics/pickups/${id}/status`, { status });
      fetchData();
    } catch (err) {
      alert('Error updating status');
    }
  };

  const updateDeliveryStatus = async (id: number, status: string) => {
    try {
      await api.put(`/logistics/deliveries/${id}/status`, { status });
      fetchData();
    } catch (err) {
      alert('Error updating status');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'Assigned': return 'default';
      case 'On the Way':
      case 'Out for Delivery': return 'warning';
      case 'Picked Up':
      case 'Delivered': return 'success';
      default: return 'outline';
    }
  };

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-sm text-primary">
        <Clock className="w-8 h-8 animate-spin" />
        <p className="font-label-md text-label-md">Loading your tasks...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-lg max-w-[1200px] mx-auto pb-xl">
      <div>
        <h1 className="font-h1 text-h1 text-primary dark:text-primary-fixed-dim">Driver Dashboard</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage your assigned pickups and deliveries</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Pickups */}
        <Card>
          <CardHeader className="border-b border-outline-variant/10 dark:border-outline/10 bg-surface-container-low dark:bg-surface-container/50 rounded-t-xl">
            <CardTitle className="flex items-center gap-sm text-[18px]">
              <Truck className="w-5 h-5 text-primary" />
              My Pickups
            </CardTitle>
          </CardHeader>
          
          <div className="divide-y divide-outline-variant/10 dark:divide-outline/10">
            {pickups.length === 0 ? (
              <div className="p-xl text-center flex flex-col items-center opacity-70">
                <Truck className="w-12 h-12 text-secondary mb-md opacity-50" />
                <p className="font-body-lg text-on-surface">No assigned pickups.</p>
              </div>
            ) : (
              pickups.map(task => (
                <div key={task.id} className="p-md sm:p-lg hover:bg-surface-bright dark:hover:bg-surface-container/50 transition-colors group">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-md">
                    <div className="flex items-start gap-sm">
                      <div className="mt-1 bg-primary-container text-on-primary p-xs rounded shadow-sm">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-label-md text-[16px] text-on-surface group-hover:text-primary transition-colors">
                          {task.order_number} - {task.customer_name}
                        </h3>
                        <div className="space-y-xs mt-sm">
                          <p className="font-body-sm text-on-surface-variant flex items-start gap-xs">
                            <MapPin className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                            <span>{task.address_line || 'No address provided'}</span>
                          </p>
                          <p className="font-body-sm text-on-surface-variant flex items-center gap-xs">
                            <Phone className="w-4 h-4 text-secondary shrink-0" />
                            <span>{task.customer_phone}</span>
                          </p>
                          <p className="font-body-sm text-on-surface-variant flex items-center gap-xs">
                            <Calendar className="w-4 h-4 text-secondary shrink-0" />
                            <span>{new Date(task.scheduled_date).toLocaleDateString()} · {task.scheduled_time}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-sm ml-[32px] sm:ml-0">
                      <Badge variant={getStatusBadgeVariant(task.status) as any}>
                        {task.status}
                      </Badge>
                      <div className="relative w-full sm:w-[140px]">
                        <select
                          className="w-full pl-sm pr-lg py-xs bg-surface-container-low dark:bg-surface-container-highest border border-outline-variant/50 rounded-md focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all font-body-sm text-body-sm text-on-surface appearance-none"
                          value={task.status}
                          onChange={(e) => updatePickupStatus(task.id, e.target.value)}
                        >
                          <option value="Assigned">Assigned</option>
                          <option value="On the Way">On the Way</option>
                          <option value="Picked Up">Picked Up</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-sm text-outline">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Deliveries */}
        <Card>
          <CardHeader className="border-b border-outline-variant/10 dark:border-outline/10 bg-surface-container-low dark:bg-surface-container/50 rounded-t-xl">
            <CardTitle className="flex items-center gap-sm text-[18px]">
              <Package className="w-5 h-5 text-primary" />
              My Deliveries
            </CardTitle>
          </CardHeader>
          
          <div className="divide-y divide-outline-variant/10 dark:divide-outline/10">
            {deliveries.length === 0 ? (
              <div className="p-xl text-center flex flex-col items-center opacity-70">
                <Package className="w-12 h-12 text-secondary mb-md opacity-50" />
                <p className="font-body-lg text-on-surface">No assigned deliveries.</p>
              </div>
            ) : (
              deliveries.map(task => (
                <div key={task.id} className="p-md sm:p-lg hover:bg-surface-bright dark:hover:bg-surface-container/50 transition-colors group">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-md">
                    <div className="flex items-start gap-sm">
                      <div className="mt-1 bg-secondary-container text-on-secondary-container p-xs rounded shadow-sm">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-label-md text-[16px] text-on-surface group-hover:text-primary transition-colors">
                          {task.order_number} - {task.customer_name}
                        </h3>
                        <div className="space-y-xs mt-sm">
                          <p className="font-body-sm text-on-surface-variant flex items-start gap-xs">
                            <MapPin className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                            <span>{task.address_line || 'No address provided'}</span>
                          </p>
                          <p className="font-body-sm text-on-surface-variant flex items-center gap-xs">
                            <Phone className="w-4 h-4 text-secondary shrink-0" />
                            <span>{task.customer_phone}</span>
                          </p>
                          <p className="font-body-sm text-on-surface-variant flex items-center gap-xs">
                            <Calendar className="w-4 h-4 text-secondary shrink-0" />
                            <span>{new Date(task.scheduled_date).toLocaleDateString()} · {task.scheduled_time}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-sm ml-[32px] sm:ml-0">
                      <Badge variant={getStatusBadgeVariant(task.status) as any}>
                        {task.status}
                      </Badge>
                      <div className="relative w-full sm:w-[140px]">
                        <select
                          className="w-full pl-sm pr-lg py-xs bg-surface-container-low dark:bg-surface-container-highest border border-outline-variant/50 rounded-md focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all font-body-sm text-body-sm text-on-surface appearance-none"
                          value={task.status}
                          onChange={(e) => updateDeliveryStatus(task.id, e.target.value)}
                        >
                          <option value="Assigned">Assigned</option>
                          <option value="Out for Delivery">Out for Delivery</option>
                          <option value="Delivered">Delivered</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-sm text-outline">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
