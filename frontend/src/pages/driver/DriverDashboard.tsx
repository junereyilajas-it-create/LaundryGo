import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, MapPin, Phone, Calendar, Clock, Navigation, 
  Package, CheckCircle2, AlertTriangle, MessageSquare, 
  DollarSign, ArrowUpRight, X, Loader2, RefreshCw, Eye 
} from 'lucide-react';
import api from '../../services/api';
import { Button } from '../../components/ui';
import OrderChatModal from '../../components/common/OrderChatModal';
import DriverTaskDetailModal from '../../components/common/DriverTaskDetailModal';

interface LogisticsTask {
  id: number;
  order_id: number;
  order_number: string;
  service_name?: string;
  total_amount?: number;
  payment_status?: string;
  payment_method?: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  status: string;
  scheduled_date?: string;
  scheduled_time?: string;
  latitude?: number;
  longitude?: number;
  failure_reason?: string;
}

export default function DriverDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'pickups' | 'deliveries'>('pickups');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [pickups, setPickups] = useState<LogisticsTask[]>([]);
  const [deliveries, setDeliveries] = useState<LogisticsTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat Modal State
  const [chatTask, setChatTask] = useState<LogisticsTask | null>(null);

  // Detail Modal State
  const [selectedDetailTask, setSelectedDetailTask] = useState<LogisticsTask | null>(null);

  // Failure Report Modal State
  const [failureModalTask, setFailureModalTask] = useState<{ id: number; type: 'pickup' | 'delivery'; order_number: string } | null>(null);
  const [failureReason, setFailureReason] = useState('Customer unavailable at address');
  const [customReason, setCustomReason] = useState('');
  const [submittingFailure, setSubmittingFailure] = useState(false);

  // COD Cash Collection Modal State
  const [codModalTask, setCodModalTask] = useState<LogisticsTask | null>(null);
  const [codAmount, setCodAmount] = useState('');
  const [codNotes, setCodNotes] = useState('');
  const [submittingCod, setSubmittingCod] = useState(false);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [pickupRes, deliveryRes] = await Promise.all([
        api.get('/logistics/pickups'),
        api.get('/logistics/deliveries')
      ]);
      setPickups(pickupRes.data);
      setDeliveries(deliveryRes.data);
    } catch (error) {
      console.error('Error fetching driver logistics:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 5000); // 5s live sync
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id: number, type: 'pickup' | 'delivery', newStatus: string) => {
    try {
      const endpoint = type === 'pickup' ? `/logistics/pickups/${id}/status` : `/logistics/deliveries/${id}/status`;
      await api.put(endpoint, { status: newStatus });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleReportFailureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failureModalTask) return;
    setSubmittingFailure(true);
    const reasonText = failureReason === 'Other' ? customReason : failureReason;

    try {
      const endpoint = failureModalTask.type === 'pickup' 
        ? `/logistics/pickups/${failureModalTask.id}/status` 
        : `/logistics/deliveries/${failureModalTask.id}/status`;

      await api.put(endpoint, {
        status: 'failed',
        failure_reason: reasonText
      });

      alert(`Report logged for ${failureModalTask.order_number}. Customer and Dispatch notified.`);
      setFailureModalTask(null);
      setCustomReason('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setSubmittingFailure(false);
    }
  };

  const handleCollectCodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codModalTask) return;
    setSubmittingCod(true);

    try {
      await api.post('/payments/cod/collect', {
        order_id: codModalTask.order_id,
        amount: parseFloat(codAmount),
        notes: codNotes || 'Collected by driver'
      });

      alert(`₱${parseFloat(codAmount).toFixed(2)} cash collected successfully for order ${codModalTask.order_number}!`);
      setCodModalTask(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record cash payment');
    } finally {
      setSubmittingCod(false);
    }
  };

  const openNavigation = (task: LogisticsTask) => {
    const destination = task.latitude && task.longitude 
      ? `${task.latitude},${task.longitude}` 
      : encodeURIComponent(task.address_line || 'Poblacion, Lagonglong, Misamis Oriental');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
          window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`, '_blank');
        },
        (err) => {
          console.warn('Driver geolocation access denied/unavailable, opening destination directions directly:', err.message);
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'picked_up':
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200';
      case 'on_the_way':
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 animate-pulse';
      case 'arrived':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200';
      case 'accepted':
      case 'assigned':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200';
    }
  };

  const tasks = activeTab === 'pickups' ? pickups : deliveries;
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return t.status === 'pending' || t.status === 'assigned';
    if (statusFilter === 'active') return t.status === 'accepted' || t.status === 'on_the_way' || t.status === 'arrived';
    if (statusFilter === 'completed') return t.status === 'picked_up' || t.status === 'delivered';
    if (statusFilter === 'failed') return t.status === 'failed' || t.status === 'cancelled';
    return true;
  });

  const activeCount = tasks.filter((t) => t.status === 'on_the_way' || t.status === 'accepted' || t.status === 'arrived').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Truck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Driver Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Dispatch logistics for Poblacion, Lagonglong • Real-Time GPS
          </p>
        </div>

        <Button
          onClick={() => navigate('/driver/map')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 shadow-md shadow-blue-500/20"
        >
          <Navigation className="w-4 h-4" />
          Interactive GPS Map
        </Button>
      </div>

      {/* Primary Tab Switcher: Pickups vs Deliveries */}
      <div className="grid grid-cols-2 gap-3 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab('pickups')}
          className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'pickups'
              ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          Pickup Tasks ({pickups.length})
        </button>

        <button
          onClick={() => setActiveTab('deliveries')}
          className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'deliveries'
              ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          Delivery Tasks ({deliveries.length})
        </button>
      </div>

      {/* Sub-Filters */}
      <div className="flex bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-200 dark:border-gray-800 gap-1 overflow-x-auto custom-scrollbar">
        {[
          { id: 'all', label: 'All Tasks' },
          { id: 'pending', label: 'Pending / Unaccepted' },
          { id: 'active', label: 'In Progress (Active)' },
          { id: 'completed', label: 'Completed' },
          { id: 'failed', label: 'Issues / Failed' }
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === f.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task Cards List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Loading assigned tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-400">
          <Truck className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
          <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">No tasks in this category</h3>
          <p className="text-xs text-gray-500 mt-1">All clean! Check other tabs or await new dispatches.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const isPickup = activeTab === 'pickups';
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-base text-gray-900 dark:text-white">
                      {task.order_number}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getStatusBadge(task.status)}`}>
                      {task.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">
                      Amount: <strong className="text-gray-900 dark:text-white">₱{parseFloat(String(task.total_amount || 0)).toFixed(2)}</strong>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase ${
                        task.payment_status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {task.payment_status || 'Unpaid'}
                    </span>
                  </div>
                </div>

                {/* Customer & Location Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-1">
                    <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">
                      Customer Details
                    </span>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{task.customer_name}</p>
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      <a href={`tel:${task.customer_phone}`} className="hover:underline text-blue-600">
                        {task.customer_phone || 'No phone'}
                      </a>
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-1">
                    <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">
                      {isPickup ? 'Pickup Location' : 'Delivery Destination'}
                    </span>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <span>{task.address_line || 'Poblacion, Lagonglong'}</span>
                    </p>
                    {task.latitude && task.longitude && (
                      <div className="pt-1 flex items-center gap-1.5 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                        <span className="bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                          GPS: {Number(task.latitude).toFixed(4)}, {Number(task.longitude).toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Service and Schedule Info */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 bg-gray-50/70 dark:bg-gray-800/30 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800">
                  {task.service_name && (
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-gray-400" />
                      <span>Service: <strong className="text-gray-800 dark:text-gray-200">{task.service_name}</strong></span>
                    </span>
                  )}
                  {(task.scheduled_date || task.scheduled_time) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>Schedule: <strong className="text-gray-800 dark:text-gray-200">{task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString() : ''} ({task.scheduled_time || 'Anytime'})</strong></span>
                    </span>
                  )}
                </div>

                {/* Failure reason if present */}
                {task.failure_reason && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                    <span className="font-bold">Issue Reported:</span> {task.failure_reason}
                  </div>
                )}

                {/* Driver Action Buttons Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  
                  {/* Secondary Tools */}
                  <div className="flex items-center gap-2">
                    {/* View Full Task Details Modal */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDetailTask(task)}
                      className="gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      Details
                    </Button>

                    {/* Chat with Customer */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setChatTask(task)}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                      Chat Customer
                    </Button>

                    {/* Turn by turn Google Maps navigation */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openNavigation(task)}
                      className="gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                      Get Directions
                    </Button>

                    {/* Collect COD Button if unpaid */}
                    {task.payment_status !== 'paid' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setCodModalTask(task);
                          setCodAmount(String(task.total_amount || 0));
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-xs font-bold"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Collect COD
                      </Button>
                    )}
                  </div>

                  {/* Primary Status Step Transitions */}
                  <div className="flex items-center gap-2">
                    
                    {/* STEP: Accept Task */}
                    {task.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(task.id, isPickup ? 'pickup' : 'delivery', isPickup ? 'accepted' : 'assigned')}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                      >
                        Accept Task
                      </Button>
                    )}

                    {/* STEP: Start Driving (On the way) */}
                    {(task.status === 'accepted' || task.status === 'assigned') && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(task.id, isPickup ? 'pickup' : 'delivery', 'on_the_way')}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        On the Way
                      </Button>
                    )}

                    {/* STEP: Mark Arrived */}
                    {task.status === 'on_the_way' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(task.id, isPickup ? 'pickup' : 'delivery', 'arrived')}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Mark Arrived
                      </Button>
                    )}

                    {/* STEP: Confirm Collection (Picked Up) or Successful Delivery */}
                    {(task.status === 'arrived' || task.status === 'on_the_way' || task.status === 'accepted' || task.status === 'assigned') && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(task.id, isPickup ? 'pickup' : 'delivery', isPickup ? 'picked_up' : 'delivered')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isPickup ? 'Confirm Pickup' : 'Confirm Delivery'}
                      </Button>
                    )}

                    {/* Report Failure / Unsuccessful Attempt */}
                    {task.status !== 'picked_up' && task.status !== 'delivered' && task.status !== 'failed' && (
                      <button
                        onClick={() => setFailureModalTask({ id: task.id, type: isPickup ? 'pickup' : 'delivery', order_number: task.order_number })}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1"
                      >
                        Report Issue
                      </button>
                    )}

                  </div>

                </div>

              </motion.div>
            );
          })}
        </div>
      )}

      {/* Customer Chat Modal */}
      {chatTask && (
        <OrderChatModal
          orderId={chatTask.order_id}
          orderNumber={chatTask.order_number}
          onClose={() => setChatTask(null)}
        />
      )}

      {/* Report Failure Modal */}
      {failureModalTask && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Report Delivery / Pickup Issue
              </h3>
              <button onClick={() => setFailureModalTask(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Order: <span className="font-bold text-gray-900 dark:text-white">{failureModalTask.order_number}</span>
            </p>

            <form onSubmit={handleReportFailureSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Select Reason</label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <option value="Customer unavailable at address">Customer unavailable at address</option>
                  <option value="Unable to contact customer phone">Unable to contact customer phone</option>
                  <option value="Incorrect address or inaccessible location">Incorrect address or inaccessible location</option>
                  <option value="Customer requested rescheduling">Customer requested rescheduling</option>
                  <option value="Severe weather / impassable road">Severe weather / impassable road</option>
                  <option value="Other">Other reason...</option>
                </select>
              </div>

              {failureReason === 'Other' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Describe Problem</label>
                  <textarea
                    rows={2}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Provide details..."
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                    required
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFailureModalTask(null)}
                  className="w-1/2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingFailure}
                  className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {submittingFailure ? 'Logging...' : 'Submit Report'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Collect COD Modal */}
      {codModalTask && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                Record Cash on Delivery (COD)
              </h3>
              <button onClick={() => setCodModalTask(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Collecting payment for order <span className="font-bold text-blue-600">{codModalTask.order_number}</span> from <span className="font-semibold text-gray-900 dark:text-white">{codModalTask.customer_name}</span>.
            </p>

            <form onSubmit={handleCollectCodSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Amount Received (PHP)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={codAmount}
                  onChange={(e) => setCodAmount(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Collector Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in exact change"
                  value={codNotes}
                  onChange={(e) => setCodNotes(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCodModalTask(null)}
                  className="w-1/2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingCod}
                  className="w-1/2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {submittingCod ? 'Recording...' : 'Confirm Cash Received'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Task Full Details Modal */}
      {selectedDetailTask && (
        <DriverTaskDetailModal
          isOpen={!!selectedDetailTask}
          onClose={() => setSelectedDetailTask(null)}
          task={selectedDetailTask}
          taskType={activeTab === 'pickups' ? 'pickup' : 'delivery'}
          onAdvanceStatus={(id, type, status) => {
            handleUpdateStatus(id, type, status);
            setSelectedDetailTask(null);
          }}
          onOpenNavigation={(task) => {
            openNavigation(task);
          }}
          onOpenCodModal={(t) => {
            setSelectedDetailTask(null);
            setCodModalTask(t);
            setCodAmount(String(t.total_amount || 0));
          }}
          onOpenFailureModal={(t, type) => {
            setSelectedDetailTask(null);
            setFailureModalTask({ id: t.id, type, order_number: t.order_number });
          }}
        />
      )}

    </div>
  );
}
