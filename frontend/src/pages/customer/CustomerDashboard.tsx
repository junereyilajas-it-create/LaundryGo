import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Clock, CheckCircle2, Truck, Package, XCircle, FileText, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, Badge, Button } from '../../components/ui';

interface Order {
  id: number;
  order_number: string;
  service_type: string;
  current_status: string;
  created_at: string;
  total_amount: number;
}

export default function CustomerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await api.get('/orders');
        setOrders(data);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'Completed': return <CheckCircle2 className="h-5 w-5 text-[#166534] dark:text-green-400" />;
      case 'Out for Delivery': return <Truck className="h-5 w-5 text-primary" />;
      case 'Ready': return <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      case 'Cancelled': return <XCircle className="h-5 w-5 text-error" />;
      default: return <Clock className="h-5 w-5 text-[#854d0e] dark:text-yellow-400" />;
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

  const requestDelivery = async (orderId: number) => {
    try {
      await api.post(`/orders/${orderId}/delivery`, {
        preferred_date: new Date().toISOString().split('T')[0],
        preferred_time: 'Afternoon'
      });
      alert('Delivery requested successfully!');
      // Refresh orders
      const { data } = await api.get('/orders');
      setOrders(data);
    } catch (err) {
      alert('Error requesting delivery');
    }
  }

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-sm text-primary">
        <Clock className="w-8 h-8 animate-spin" />
        <p className="font-label-md text-label-md">Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-lg max-w-[1200px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-md">
        <div>
          <h1 className="font-h1 text-h1 text-primary dark:text-primary-fixed-dim">My Laundry</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Track and manage your laundry orders</p>
        </div>
        <Link to="/customer/request">
          <Button className="w-full sm:w-auto shadow-sm">
            <Plus className="mr-sm h-5 w-5" />
            Request Service
          </Button>
        </Link>
      </div>

      {/* Orders List Section */}
      <Card>
        <CardHeader className="border-b border-outline-variant/10 dark:border-outline/10">
          <CardTitle className="flex items-center gap-sm text-[18px]">
            <FileText className="w-5 h-5 text-primary" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        
        {orders.length === 0 ? (
          <div className="p-xl text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-surface-variant rounded-full flex items-center justify-center text-primary mb-md">
              <Package className="w-8 h-8" />
            </div>
            <p className="font-body-lg text-on-surface mb-xs">No orders found</p>
            <p className="font-body-md text-on-surface-variant mb-md">You haven't requested any laundry services yet.</p>
            <Link to="/customer/request">
              <Button variant="outline">Start Your First Request</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10 dark:divide-outline/10">
            {orders.map((order) => (
              <div key={order.id} className="p-md sm:p-lg hover:bg-surface-bright dark:hover:bg-surface-container transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
                  <div className="flex items-start gap-md">
                    <div className="mt-xs p-sm bg-surface-container-low dark:bg-surface-container rounded-lg border border-outline-variant/30">
                      {getStatusIcon(order.current_status)}
                    </div>
                    <div>
                      <h3 className="font-label-md text-[16px] text-on-surface group-hover:text-primary transition-colors">
                        Order #{order.order_number}
                      </h3>
                      <p className="font-body-sm text-on-surface-variant mt-xs flex items-center gap-sm">
                        <span>{new Date(order.created_at).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                        <span>{order.service_type}</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-md ml-[52px] sm:ml-0">
                    <Badge variant={getStatusBadgeVariant(order.current_status) as any}>
                      {order.current_status}
                    </Badge>
                    <div className="font-label-md text-[16px] text-on-surface tabular-nums">
                      ₱{order.total_amount.toFixed(2)}
                    </div>
                    {order.current_status === 'Ready' && (
                       <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => requestDelivery(order.id)}
                       >
                         Request Delivery
                       </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
