import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Package, Search, Edit, Trash2, Eye, Plus, X, 
  AlertCircle, MessageSquare, Truck, RefreshCw, CheckCircle2, 
  Scale, Clock, User, Phone, MapPin, DollarSign, Calendar, ArrowRight,
  ShieldAlert, AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import { Badge, Button } from '../../components/ui';
import OrderChatModal from '../../components/common/OrderChatModal';
import ConfirmModal, { type ConfirmModalProps } from '../../components/common/ConfirmModal';
import { calculateLaundryPricing, type PricingResult } from '../../lib/pricingCalculator';
import StatusBadge from '../../components/common/StatusBadge';
import AddCustomerLaundryModal from '../../components/common/AddCustomerLaundryModal';
import TransactionFeedbackModal from '../../components/common/TransactionFeedbackModal';

interface LoadDetail {
  loadNumber: number;
  weight: number;
  price: number;
  description: string;
}

interface StatusHistoryItem {
  id: number;
  order_id: number;
  status: string;
  notes?: string;
  changed_by?: number;
  changed_by_name?: string;
  changed_by_role?: string;
  created_at: string;
}

interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  service_type: string;
  service_name?: string;
  status: string;
  current_status?: string;
  payment_status?: string;
  payment_method?: string;
  estimated_weight?: number;
  actual_weight?: number;
  load_count?: number;
  load_details?: LoadDetail[] | string;
  pricing_version?: string;
  weight_approved_by_customer?: number;
  weight_approved_at?: string;
  weight_recorded_at?: string;
  rejection_reason?: string;
  processing_stage?: string;
  total_amount?: number;
  preferred_date?: string;
  preferred_time?: string;
  special_instructions?: string;
  created_at: string;
  pickup_id?: number;
  pickup_status?: string;
  pickup_driver_id?: number;
  pickup_driver_name?: string;
  pickup_driver_phone?: string;
  delivery_id?: number;
  delivery_status?: string;
  delivery_driver_id?: number;
  delivery_driver_name?: string;
  delivery_driver_phone?: string;
  estimated_amount?: number | string | null;
  final_amount?: number | string | null;
  pickup_latitude?: number | string | null;
  pickup_longitude?: number | string | null;
  delivery_latitude?: number | string | null;
  delivery_longitude?: number | string | null;
  pickup_address_text?: string;
  delivery_address_text?: string;
  is_walkin?: boolean | number;
  customer_choice?: string;
  processing_started_at?: string;
  ready_at?: string;
  completed_at?: string;
  payment_collected_by?: number;
  payment_collected_at?: string;
  payment_collected_by_name?: string;
  history?: StatusHistoryItem[];
}

interface DriverOption {
  id: number;
  name: string;
  phone: string;
  email: string;
  active_pickups: number;
  active_deliveries: number;
}

const ORDER_CATEGORIES = [
  { id: 'all', label: 'All Orders' },
  { id: 'Pending Approval', label: 'Pending Approval' },
  { id: 'Approved', label: 'Approved' },
  { id: 'Driver Assigned', label: 'Driver Assigned' },
  { id: 'Pickup in Progress', label: 'Pickup in Progress' },
  { id: 'Picked Up', label: 'Picked Up' },
  { id: 'Weighing', label: 'Weighing / Awaiting Final Price' },
  { id: 'Processing', label: 'Processing' },
  { id: 'Ready for Pickup/Delivery', label: 'Ready for Pickup / Delivery' },
  { id: 'Out for Delivery', label: 'Out for Delivery' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Cancelled', label: 'Cancelled' }
];

export default function WorkerOrders() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  
  // Add Walk-in Customer Laundry Modal State
  const [isAddLaundryModalOpen, setIsAddLaundryModalOpen] = useState(false);

  // Accessible Action Confirmation & Feedback Modal State
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: React.ReactNode;
    onTryAgain?: () => void;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });
  
  // Detailed Order Management Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Driver Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<DriverOption[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [assignTaskType, setAssignTaskType] = useState<'pickup' | 'delivery'>('pickup');
  const [driverSearch, setDriverSearch] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Record Weight Modal State
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [scaleWeight, setScaleWeight] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [livePricing, setLivePricing] = useState<PricingResult | null>(null);
  const [submittingWeight, setSubmittingWeight] = useState(false);

  // Reject Request Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Service area unavailable or capacity full');
  const [customRejectionReason, setCustomRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Chat Modal State
  const [chatOrder, setChatOrder] = useState<{ id: number; order_number: string } | null>(null);

  // Accessible Action Confirmation & Feedback Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<ConfirmModalProps | null>(null);

  // Action Loading
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchOrdersAndCounts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [ordersRes, countsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/orders/workflow/counts')
      ]);
      setOrders(ordersRes.data);
      setTabCounts(countsRes.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndCounts();
    const interval = setInterval(() => fetchOrdersAndCounts(true), 5000); // 5s live polling
    return () => clearInterval(interval);
  }, []);

  // Listen to ?orderId= parameter from notifications or deep links
  useEffect(() => {
    const targetOrderId = searchParams.get('orderId');
    if (targetOrderId) {
      const parsed = parseInt(targetOrderId, 10);
      if (!isNaN(parsed)) {
        openOrderDetail(parsed);
      }
    }
  }, [searchParams]);

  // Fetch full single order details (with audit history) when modal opens or refreshes
  const openOrderDetail = async (orderId: number) => {
    try {
      setModalLoading(true);
      const { data } = await api.get(`/orders/${orderId}`);
      setSelectedOrder(data);
    } catch (error) {
      console.error('Error loading order details:', error);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Could Not Load Order',
        message: 'Could not load complete order details from server. Please try again.'
      });
    } finally {
      setModalLoading(false);
    }
  };

  const refreshCurrentOrder = async () => {
    if (selectedOrder) {
      await openOrderDetail(selectedOrder.id);
    }
    fetchOrdersAndCounts(true);
  };

  // Start Processing Handler
  const handleStartProcessing = async (orderId: number) => {
    setActionInProgress(true);
    try {
      await api.put(`/orders/${orderId}/start-processing`);
      await refreshCurrentOrder();
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Processing Started',
        message: 'Laundry order is now in processing. The customer has been notified with the approximately 2-hour timeline.'
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Failed to Start Processing',
        message: err.response?.data?.message || 'Could not update laundry to Processing status.',
        onTryAgain: () => handleStartProcessing(orderId)
      });
    } finally {
      setActionInProgress(false);
    }
  };

  // Mark Laundry as Ready Handler
  const handleMarkReady = async (orderId: number) => {
    setActionInProgress(true);
    try {
      await api.put(`/orders/${orderId}/mark-ready`);
      await refreshCurrentOrder();
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Laundry Marked as Ready',
        message: 'Laundry marked as Ready for Pickup/Delivery. Customer has been notified to choose Delivery or Self-Pickup.'
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Failed to Mark Ready',
        message: err.response?.data?.message || 'Could not mark laundry as ready.',
        onTryAgain: () => handleMarkReady(orderId)
      });
    } finally {
      setActionInProgress(false);
    }
  };

  // Mark Order as Completed Handler
  const handleCompleteOrder = async (orderId: number) => {
    setActionInProgress(true);
    try {
      await api.put(`/orders/${orderId}/complete`);
      await refreshCurrentOrder();
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Order Completed',
        message: 'Laundry order has been successfully marked as Completed. Customer notification recorded.'
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Failed to Complete Order',
        message: err.response?.data?.message || 'Could not complete laundry transaction.',
        onTryAgain: () => handleCompleteOrder(orderId)
      });
    } finally {
      setActionInProgress(false);
    }
  };

  // Update Payment Status Handler (Unpaid <-> Paid)
  const handleUpdatePaymentStatus = async (orderId: number, newStatus: 'paid' | 'unpaid') => {
    setActionInProgress(true);
    try {
      await api.put(`/orders/${orderId}/payment-status`, { payment_status: newStatus });
      await refreshCurrentOrder();
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Payment Status Updated',
        message: `Order payment has been marked as ${newStatus.toUpperCase()}.${newStatus === 'paid' ? ' Payment timestamp and recording worker have been saved.' : ''}`
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Payment Update Failed',
        message: err.response?.data?.message || 'Failed to update payment status.',
        onTryAgain: () => handleUpdatePaymentStatus(orderId, newStatus)
      });
    } finally {
      setActionInProgress(false);
    }
  };

  // 1. Worker: Approve Request
  const handleApproveOrder = () => {
    if (!selectedOrder) return;
    setConfirmModalConfig({
      isOpen: true,
      title: 'Approve Laundry Request',
      message: (
        <div className="space-y-2">
          <p>Approve laundry request <strong className="text-gray-900 dark:text-white">{selectedOrder.order_number}</strong>?</p>
          <p className="text-xs text-gray-500">This will advance the order status and make it available for pickup driver assignment.</p>
        </div>
      ),
      confirmText: 'Approve Request',
      variant: 'success',
      onClose: () => setConfirmModalConfig(null),
      onConfirm: async () => {
        setConfirmModalConfig(null);
        setActionInProgress(true);
        try {
          await api.put(`/orders/${selectedOrder.id}/approve`);
          await refreshCurrentOrder();
          setConfirmModalConfig({
            isOpen: true,
            title: 'Order Approved',
            message: `Order ${selectedOrder.order_number} has been approved. You can now assign a pickup driver.`,
            confirmText: 'OK',
            cancelText: '',
            variant: 'success',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        } catch (error: any) {
          setConfirmModalConfig({
            isOpen: true,
            title: 'Approval Failed',
            message: error.response?.data?.message || 'Failed to approve order',
            confirmText: 'Close',
            cancelText: '',
            variant: 'danger',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        } finally {
          setActionInProgress(false);
        }
      }
    });
  };

  // 2. Worker: Reject Request
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const finalReason = rejectionReason === 'Other' ? customRejectionReason : rejectionReason;
    if (!finalReason) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Rejection Reason Required',
        message: 'Please provide a reason for rejecting the request.',
        confirmText: 'Understood',
        cancelText: '',
        variant: 'warning',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
      return;
    }

    setSubmittingReject(true);
    try {
      await api.put(`/orders/${selectedOrder.id}/reject`, { rejection_reason: finalReason });
      setRejectModalOpen(false);
      setCustomRejectionReason('');
      await refreshCurrentOrder();
      setConfirmModalConfig({
        isOpen: true,
        title: 'Order Rejected',
        message: `Order ${selectedOrder.order_number} has been marked as rejected.`,
        confirmText: 'OK',
        cancelText: '',
        variant: 'info',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } catch (error: any) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Rejection Failed',
        message: error.response?.data?.message || 'Failed to reject order',
        confirmText: 'Close',
        cancelText: '',
        variant: 'danger',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } finally {
      setSubmittingReject(false);
    }
  };

  // 3. Worker: Open Driver Assignment Modal
  const openAssignDriverModal = async (taskType: 'pickup' | 'delivery') => {
    setAssignTaskType(taskType);
    setSelectedDriverId(null);
    setDriverSearch('');
    setAssignModalOpen(true);
    setLoadingDrivers(true);

    try {
      const { data } = await api.get('/orders/drivers/available');
      setAvailableDrivers(data);
    } catch (error) {
      console.error('Error loading drivers:', error);
      setConfirmModalConfig({
        isOpen: true,
        title: 'Network Error',
        message: 'Could not load available drivers. Please try again.',
        confirmText: 'Close',
        cancelText: '',
        variant: 'danger',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleAssignDriverSubmit = async () => {
    if (!selectedOrder || !selectedDriverId) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Driver Selection Required',
        message: 'Please select an active driver from the list before confirming assignment.',
        confirmText: 'OK',
        cancelText: '',
        variant: 'warning',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
      return;
    }

    setSubmittingAssign(true);
    try {
      await api.put(`/orders/${selectedOrder.id}/assign-driver`, {
        driver_id: selectedDriverId,
        task_type: assignTaskType
      });
      setAssignModalOpen(false);
      await refreshCurrentOrder();
      setConfirmModalConfig({
        isOpen: true,
        title: 'Driver Assigned',
        message: `Driver successfully assigned for ${assignTaskType} task!`,
        confirmText: 'OK',
        cancelText: '',
        variant: 'success',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } catch (error: any) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Assignment Failed',
        message: error.response?.data?.message || 'Failed to assign driver',
        confirmText: 'Close',
        cancelText: '',
        variant: 'danger',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } finally {
      setSubmittingAssign(false);
    }
  };

  // 4. Worker: Confirm Laundry Received (Physical receipt from driver/customer)
  const handleConfirmReceipt = () => {
    if (!selectedOrder) return;
    setConfirmModalConfig({
      isOpen: true,
      title: 'Confirm Physical Receipt',
      message: (
        <div className="space-y-2">
          <p>Confirm physical receipt of laundry items for <strong className="text-gray-900 dark:text-white">{selectedOrder.order_number}</strong>?</p>
          <p className="text-xs text-gray-500">This confirms the driver delivered the bags to the laundry facility and unlocks the weighing scale.</p>
        </div>
      ),
      confirmText: 'Confirm Receipt',
      variant: 'success',
      onClose: () => setConfirmModalConfig(null),
      onConfirm: async () => {
        setConfirmModalConfig(null);
        setActionInProgress(true);
        try {
          await api.put(`/orders/${selectedOrder.id}/confirm-receipt`, {
            notes: 'Laundry physically received at shop. Ready for weighing.'
          });
          await refreshCurrentOrder();
          setConfirmModalConfig({
            isOpen: true,
            title: 'Laundry Received',
            message: 'Laundry confirmed received at shop! You can now record the calibrated scale weight.',
            confirmText: 'Record Weight',
            cancelText: 'Later',
            variant: 'success',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => {
              setConfirmModalConfig(null);
              openRecordWeightModal();
            }
          });
        } catch (error: any) {
          setConfirmModalConfig({
            isOpen: true,
            title: 'Action Failed',
            message: error.response?.data?.message || 'Failed to confirm receipt',
            confirmText: 'Close',
            cancelText: '',
            variant: 'danger',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        } finally {
          setActionInProgress(false);
        }
      }
    });
  };

  // 5. Worker: Open Record Weight Modal & Live Preview
  const openRecordWeightModal = () => {
    setScaleWeight('');
    setWeightNotes('');
    setLivePricing(null);
    setWeightModalOpen(true);
  };

  const handleScaleWeightChange = (val: string) => {
    setScaleWeight(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      const calc = calculateLaundryPricing(num);
      setLivePricing(calc);
    } else {
      setLivePricing(null);
    }
  };

  const handleRecordWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const num = parseFloat(scaleWeight);
    if (isNaN(num) || num <= 0) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Invalid Scale Weight',
        message: 'Please enter a valid scale weight greater than 0 kg.',
        confirmText: 'OK',
        cancelText: '',
        variant: 'warning',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
      return;
    }

    setSubmittingWeight(true);
    try {
      const { data } = await api.post(`/orders/${selectedOrder.id}/record-weight`, {
        actual_weight: num,
        notes: weightNotes || 'Weighed and verified on scale'
      });
      setWeightModalOpen(false);
      await refreshCurrentOrder();
      if (data.pricing?.isOverweight) {
        setConfirmModalConfig({
          isOpen: true,
          title: 'Multi-Load Proposal Dispatched',
          message: `Weight ${num} kg recorded. This order exceeds the standard single load (> 8 kg). A multi-load proposal (₱${data.pricing?.totalAmount.toFixed(2)}) has been dispatched to the customer for approval.`,
          confirmText: 'Understood',
          cancelText: '',
          variant: 'info',
          onClose: () => setConfirmModalConfig(null),
          onConfirm: () => setConfirmModalConfig(null)
        });
      } else {
        setConfirmModalConfig({
          isOpen: true,
          title: 'Scale Weight Verified',
          message: `Weight ${num} kg recorded. Pricing set to ₱${data.pricing?.totalAmount.toFixed(2)}. Processing stage is now Washing.`,
          confirmText: 'OK',
          cancelText: '',
          variant: 'success',
          onClose: () => setConfirmModalConfig(null),
          onConfirm: () => setConfirmModalConfig(null)
        });
      }
    } catch (error: any) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Error Recording Weight',
        message: error.response?.data?.message || 'Failed to record laundry weight',
        confirmText: 'Close',
        cancelText: '',
        variant: 'danger',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } finally {
      setSubmittingWeight(false);
    }
  };

  // 5b. Worker: Send Price to Customer
  const handleSendPriceToCustomer = () => {
    if (!selectedOrder) return;
    if (!selectedOrder.actual_weight || selectedOrder.actual_weight <= 0) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Weight Not Recorded',
        message: 'Please record the actual measured weight on calibrated scales first before sending price calculation to customer.',
        confirmText: 'OK',
        cancelText: '',
        variant: 'warning',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
      return;
    }
    const finalBill = selectedOrder.final_amount !== null && selectedOrder.final_amount !== undefined ? selectedOrder.final_amount : selectedOrder.total_amount;
    
    setConfirmModalConfig({
      isOpen: true,
      title: 'Send Final Price Notification',
      message: (
        <div className="space-y-2">
          <p>Send pricing calculation (<strong className="text-emerald-600 font-bold">₱{parseFloat(String(finalBill || 0)).toFixed(2)}</strong> for {selectedOrder.actual_weight} kg) to customer <strong className="text-gray-900 dark:text-white">{selectedOrder.customer_name}</strong>?</p>
          <p className="text-xs text-gray-500">The customer will receive an immediate in-app and SMS notification with the finalized bill.</p>
        </div>
      ),
      confirmText: 'Send Notification',
      variant: 'success',
      onClose: () => setConfirmModalConfig(null),
      onConfirm: async () => {
        setConfirmModalConfig(null);
        setActionInProgress(true);
        try {
          const res = await api.put(`/orders/${selectedOrder.id}/send-price`);
          await refreshCurrentOrder();
          setConfirmModalConfig({
            isOpen: true,
            title: 'Price Notification Dispatched',
            message: res.data.message || 'Pricing details and notifications sent to customer successfully.',
            confirmText: 'OK',
            cancelText: '',
            variant: 'success',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        } catch (error: any) {
          setConfirmModalConfig({
            isOpen: true,
            title: 'Dispatch Failed',
            message: error.response?.data?.message || 'Failed to send price to customer',
            confirmText: 'Close',
            cancelText: '',
            variant: 'danger',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        } finally {
          setActionInProgress(false);
        }
      }
    });
  };

  // 6. Worker: Advance Processing Stage
  const handleAdvanceProcessingStage = (nextStage: string) => {
    if (!selectedOrder) return;
    setConfirmModalConfig({
      isOpen: true,
      title: 'Advance Processing Stage',
      message: (
        <div className="space-y-2">
          <p>Advance laundry processing stage for <strong className="text-gray-900 dark:text-white">{selectedOrder.order_number}</strong> to <span className="font-bold text-blue-600">"{nextStage}"</span>?</p>
          <p className="text-xs text-gray-500">The customer tracking timeline will immediately reflect this progress step.</p>
        </div>
      ),
      confirmText: `Advance to ${nextStage}`,
      variant: 'info',
      onClose: () => setConfirmModalConfig(null),
      onConfirm: async () => {
        setConfirmModalConfig(null);
        setActionInProgress(true);
        try {
          await api.put(`/orders/${selectedOrder.id}/processing-stage`, {
            stage: nextStage,
            notes: `Stage advanced to ${nextStage} by laundry staff`
          });
          await refreshCurrentOrder();
          setConfirmModalConfig({
            isOpen: true,
            title: 'Stage Updated',
            message: `Processing stage updated to ${nextStage}!`,
            confirmText: 'OK',
            cancelText: '',
            variant: 'success',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        } catch (error: any) {
          setConfirmModalConfig({
            isOpen: true,
            title: 'Update Failed',
            message: error.response?.data?.message || 'Failed to update processing stage',
            confirmText: 'Close',
            cancelText: '',
            variant: 'danger',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        } finally {
          setActionInProgress(false);
        }
      }
    });
  };

  const matchesCategory = (order: Order, categoryId: string) => {
    const st = (order.status || order.current_status || '').trim();
    switch (categoryId) {
      case 'all':
        return true;
      case 'Pending Approval':
        return st === 'Pending Approval' || st === 'Pending Request' || st === 'Pending';
      case 'Approved':
        return st === 'Approved' || st === 'Awaiting Pickup Assignment' || st === 'Confirmed';
      case 'Driver Assigned':
        return st === 'Driver Assigned' || st === 'Pickup Scheduled';
      case 'Pickup in Progress':
        return st === 'Pickup in Progress' || st === 'on_the_way';
      case 'Picked Up':
        return st === 'Picked Up' || st === 'Laundry Received' || st === 'picked_up';
      case 'Weighing':
        return st === 'Weighing' || st === 'Awaiting Customer Approval' || st === 'Awaiting Customer Confirmation';
      case 'Processing':
        return st === 'Processing' || st === 'Washing' || st === 'Drying' || st === 'Folding' || st === 'Quality Check';
      case 'Ready for Pickup/Delivery':
      case 'Ready for Delivery':
        return st === 'Ready for Pickup/Delivery' || st === 'Ready for Delivery' || st === 'Ready' || st === 'Customer Pickup';
      case 'Out for Delivery':
        return st === 'Out for Delivery' || st === 'Delivery in Progress' || st === 'Delivery Assigned' || st === 'out_for_delivery';
      case 'Completed':
        return st === 'Completed' || st === 'Delivered' || st === 'delivered';
      case 'Cancelled':
        return st === 'Cancelled' || st === 'Rejected' || st === 'Customer Rejected Weight Proposal';
      default:
        return st === categoryId;
    }
  };

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return orders.length;
    return orders.filter((o) => matchesCategory(o, categoryId)).length;
  };

  // Filtered orders logic
  const filteredOrders = orders.filter((order) => {
    const effectiveStatus = order.status || order.current_status || '';
    const matchesTab = matchesCategory(order, activeTab);

    // Search term matching
    const sTerm = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      !sTerm ||
      order.order_number.toLowerCase().includes(sTerm) ||
      order.customer_name.toLowerCase().includes(sTerm) ||
      effectiveStatus.toLowerCase().includes(sTerm) ||
      (order.service_name || order.service_type || '').toLowerCase().includes(sTerm);

    return matchesTab && matchesSearch;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'Delivered':
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300';
      case 'Processing':
      case 'Washing':
      case 'Drying':
      case 'Folding':
      case 'Quality Check':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-300 animate-pulse';
      case 'Ready for Pickup/Delivery':
      case 'Ready for Delivery':
      case 'Ready':
      case 'Customer Pickup':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 border-teal-300';
      case 'Awaiting Customer Approval':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 animate-bounce';
      case 'Laundry Received':
      case 'Picked Up':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-300';
      case 'Cancelled':
      case 'Customer Rejected Weight Proposal':
        return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300';
    }
  };

  const getNextActionLabel = (order: Order) => {
    const st = order.status || order.current_status || '';
    switch(st) {
      case 'Pending Approval':
      case 'Pending Request':
      case 'Pending':
        return { label: 'Start Processing', color: 'bg-blue-600 text-white' };
      case 'Approved':
      case 'Awaiting Pickup Assignment':
        return { label: 'Assign Driver', color: 'bg-indigo-600 text-white' };
      case 'Driver Assigned':
      case 'Pickup in Progress':
        return { label: 'Pickup En Route', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' };
      case 'Picked Up':
        return { label: 'Confirm Receipt', color: 'bg-purple-600 text-white' };
      case 'Laundry Received':
        return { label: 'Start Processing', color: 'bg-amber-600 text-white' };
      case 'Awaiting Customer Approval':
        return { label: 'Awaiting Customer', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      case 'Customer Rejected Weight Proposal':
        return { label: 'Resolve Rejection', color: 'bg-red-600 text-white' };
      case 'Processing':
        return { label: 'Mark as Ready', color: 'bg-emerald-600 text-white' };
      case 'Ready for Pickup/Delivery':
      case 'Ready':
      case 'Ready for Delivery':
        if (order.customer_choice === 'self_pickup') {
          return { label: 'Mark Completed', color: 'bg-emerald-600 text-white' };
        }
        if (order.customer_choice === 'delivery' || st === 'Ready for Delivery') {
          return { label: 'Assign Delivery', color: 'bg-indigo-600 text-white' };
        }
        return { label: 'Awaiting Choice', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      case 'Customer Pickup':
        return { label: 'Mark Completed', color: 'bg-emerald-600 text-white' };
      case 'Delivery Assigned':
      case 'Out for Delivery':
        return { label: 'Delivery En Route', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      case 'Delivered':
      case 'Completed':
        return { label: 'Completed', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
      default:
        return { label: 'View Details', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Package className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Worker Order Workflow
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage laundry requests from submission to weighing, processing, and delivery in Poblacion, Lagonglong
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchOrdersAndCounts()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-blue-600" />
            Refresh Orders
          </button>

          <Button
            onClick={() => setIsAddLaundryModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 px-4 py-2 rounded-xl shadow-md shadow-blue-600/20 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Customer Laundry
          </Button>
        </div>
      </div>

      {/* Category Dropdown & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        
        {/* Category Dropdown Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
            Category:
          </label>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
          >
            {ORDER_CATEGORIES.map((cat) => {
              const count = getCategoryCount(cat.id);
              return (
                <option key={cat.id} value={cat.id}>
                  {cat.label} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by order number (e.g. LAU-2026), customer name, or service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
        </div>

        <div className="text-xs text-gray-500 self-center sm:self-auto px-2">
          Showing <strong>{filteredOrders.length}</strong> of {orders.length} orders
        </div>
      </div>

      {/* Desktop Table & Mobile Cards */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col justify-center items-center text-gray-400 space-y-2">
            <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-xs">Loading orders from database...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center text-gray-400 space-y-2">
            <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No orders found</h3>
            <p className="text-xs text-gray-500">There are no orders matching this filter or search query.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase tracking-wider text-[11px] border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Order # & Date</th>
                    <th className="py-3.5 px-4 font-bold">Customer</th>
                    <th className="py-3.5 px-4 font-bold">Service & Weight</th>
                    <th className="py-3.5 px-4 font-bold">Payment</th>
                    <th className="py-3.5 px-4 font-bold">Status & Driver</th>
                    <th className="py-3.5 px-4 font-bold">Next Action</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredOrders.map((order) => {
                    const effectiveStatus = order.status || order.current_status || 'Pending Request';
                    const nextAction = getNextActionLabel(order);
                    const isCod = (order.payment_method || '').toUpperCase() === 'COD';
                    const isPaid = order.payment_status === 'paid' || order.payment_status === 'Paid (Demo)';

                    return (
                      <tr 
                        key={order.id} 
                        onClick={() => openOrderDetail(order.id)}
                        className="cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors group"
                      >
                        {/* Order Number & Date */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 block group-hover:underline">
                            {order.order_number}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-gray-900 dark:text-white block">
                            {order.customer_name}
                          </span>
                          <span className="text-[11px] text-gray-500 font-mono">
                            {order.customer_phone || 'No phone'}
                          </span>
                        </td>

                        {/* Service & Weight */}
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-gray-800 dark:text-gray-200 block">
                            {order.service_name || order.service_type}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <Scale className="w-3 h-3 text-blue-500" />
                            {order.actual_weight 
                              ? `${order.actual_weight} kg (${order.load_count || 1} load)` 
                              : order.estimated_weight 
                                ? `Est. ${order.estimated_weight} kg` 
                                : 'Pending weight'}
                          </span>
                        </td>

                        {/* Payment */}
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-gray-900 dark:text-white block">
                            ₱{parseFloat(String(order.total_amount || 0)).toFixed(2)}
                          </span>
                          <span className={`text-[10px] font-bold uppercase ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {order.payment_method || 'COD'} • {order.payment_status || 'Pending'}
                          </span>
                        </td>

                        {/* Status & Assigned Driver */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={effectiveStatus} type="order" />
                          {(order.pickup_driver_name || order.delivery_driver_name) && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5 flex items-center gap-1">
                              <Truck className="w-3 h-3 text-indigo-500" />
                              {order.delivery_driver_name ? `Del: ${order.delivery_driver_name}` : `Pick: ${order.pickup_driver_name}`}
                            </span>
                          )}
                        </td>

                        {/* Required Next Action */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${nextAction.color}`}>
                            {nextAction.label}
                          </span>
                        </td>

                        {/* Row Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setChatOrder({ id: order.id, order_number: order.order_number })}
                              title="Chat Customer / Driver"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openOrderDetail(order.id)}
                              title="Manage Order"
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {filteredOrders.map((order) => {
                const effectiveStatus = order.status || order.current_status || 'Pending Request';
                const nextAction = getNextActionLabel(order);
                const isPaid = order.payment_status === 'paid' || order.payment_status === 'Paid (Demo)';

                return (
                  <div
                    key={order.id}
                    onClick={() => openOrderDetail(order.id)}
                    className="p-4 space-y-3 cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20 active:bg-blue-100/50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                          {order.order_number}
                        </span>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{order.customer_name}</h4>
                        <span className="text-[11px] text-gray-400">
                          {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-sm text-gray-900 dark:text-white block">
                          ₱{parseFloat(String(order.total_amount || 0)).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {order.payment_method || 'COD'} • {order.payment_status || 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800 text-xs">
                      <StatusBadge status={effectiveStatus} type="order" />
                      <span className={`px-2 py-0.5 rounded-lg font-bold text-[11px] ${nextAction.color}`}>
                        {nextAction.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DETAILED ORDER MANAGEMENT MODAL (Nielsen Usability: Full Visibility of Status) */}
      {/* ========================================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 flex justify-between items-start shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-extrabold text-lg text-blue-600 dark:text-blue-400">
                    {selectedOrder.order_number}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeVariant(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Requested on {new Date(selectedOrder.created_at).toLocaleString()} • {selectedOrder.service_name || selectedOrder.service_type}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChatOrder({ id: selectedOrder.id, order_number: selectedOrder.order_number })}
                  className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 text-xs sm:text-sm">
              
              {/* Overweight Customer Decision Banner if relevant */}
              {selectedOrder.status === 'Awaiting Customer Approval' && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    Overweight Proposal Sent to Customer
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    The recorded weight ({selectedOrder.actual_weight} kg) exceeds 8 kg. A proposed multi-load breakdown of ₱{parseFloat(String(selectedOrder.total_amount || 0)).toFixed(2)} was sent to the customer for explicit confirmation. Processing is paused until approved.
                  </p>
                </div>
              )}

              {selectedOrder.status === 'Customer Rejected Weight Proposal' && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                    Customer Rejected Weight Proposal
                  </div>
                  <p className="text-xs text-red-800 dark:text-red-300">
                    Reason: {selectedOrder.rejection_reason || 'Customer declined additional charges'}. Please contact the customer to resolve or arrange cancellation and laundry return.
                  </p>
                </div>
              )}

              {/* Processing Stage Banner & 4-Stage Stepper */}
              {selectedOrder.status === 'Processing' && (
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                      Laundry In Process • Stage: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{selectedOrder.processing_stage || 'Washing'}</span>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-300 font-semibold bg-blue-100/70 dark:bg-blue-900/50 px-2.5 py-0.5 rounded-full">
                      Step {Math.max(1, ['Washing', 'Drying', 'Folding', 'Quality Check'].indexOf(selectedOrder.processing_stage || 'Washing') + 1)} of 4
                    </span>
                  </div>
                  
                  {/* 4 Processing Stages Stepper */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {[
                      { stage: 'Washing', num: 1 },
                      { stage: 'Drying', num: 2 },
                      { stage: 'Folding', num: 3 },
                      { stage: 'Quality Check', num: 4 }
                    ].map(({ stage, num }) => {
                      const stages = ['Washing', 'Drying', 'Folding', 'Quality Check'];
                      const currentIdx = stages.indexOf(selectedOrder.processing_stage || 'Washing');
                      const stageIdx = stages.indexOf(stage);
                      const isCurrent = (selectedOrder.processing_stage || 'Washing') === stage;
                      const isPast = stageIdx < currentIdx;

                      return (
                        <button
                          key={stage}
                          type="button"
                          disabled={actionInProgress || isCurrent}
                          onClick={() => handleAdvanceProcessingStage(stage)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isCurrent
                              ? 'border-blue-600 bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 font-bold shadow-xs ring-2 ring-blue-500/30'
                              : isPast
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold hover:border-blue-400'
                              : 'border-blue-200/60 dark:border-blue-900/40 bg-white/60 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold mb-0.5">
                            <span>Stage {num}</span>
                            {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                            {isCurrent && <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />}
                          </div>
                          <span className="text-xs font-bold block">{stage}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    Click any stage above to advance laundry progress, or click Next Stage / Mark as Ready below.
                  </p>
                </div>
              )}

              {/* Ready for Pickup/Delivery Banner */}
              {(selectedOrder.status === 'Ready for Pickup/Delivery' || selectedOrder.status === 'Ready' || selectedOrder.status === 'Ready for Delivery' || selectedOrder.status === 'Customer Pickup') && (
                <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 space-y-1.5 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    Laundry Ready for Customer
                  </div>
                  <div className="text-xs text-teal-800 dark:text-teal-300">
                    {selectedOrder.customer_choice === 'delivery' || selectedOrder.status === 'Ready for Delivery' ? (
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300 block">
                        🚚 Customer Selected: <strong>Doorstep Delivery</strong> to {selectedOrder.delivery_address_text || selectedOrder.pickup_address_text || 'Customer address'}.
                      </span>
                    ) : selectedOrder.customer_choice === 'self_pickup' || selectedOrder.status === 'Customer Pickup' ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300 block">
                        🏪 Customer Selected: <strong>Self-Pickup</strong>. Awaiting customer to collect items at shop.
                      </span>
                    ) : (
                      <span className="italic block">
                        ⏳ Awaiting customer selection: Customer has been notified to choose Delivery or Self-Pickup.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Grid: Customer Details & Addresses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Details */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">
                      Customer Information
                    </span>
                    {selectedOrder.is_walkin ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                        Walk-in Laundry
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
                        Online Request
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-gray-900 dark:text-white">{selectedOrder.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 font-mono text-xs">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <a href={`tel:${selectedOrder.customer_phone}`} className="hover:underline">{selectedOrder.customer_phone || 'N/A'}</a>
                  </div>
                  {selectedOrder.customer_email && (
                    <div className="text-[11px] text-gray-500 truncate">{selectedOrder.customer_email}</div>
                  )}
                </div>

                {/* Preferred Schedule & Payment Info */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">
                      Schedule & Payment
                    </span>
                    {/* Worker Payment Status Toggle */}
                    <button
                      type="button"
                      disabled={actionInProgress}
                      onClick={() => handleUpdatePaymentStatus(
                        selectedOrder.id,
                        (selectedOrder.payment_status === 'paid' || selectedOrder.payment_status === 'Paid (Demo)') ? 'unpaid' : 'paid'
                      )}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                        selectedOrder.payment_status === 'paid' || selectedOrder.payment_status === 'Paid (Demo)'
                          ? 'border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                          : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      {selectedOrder.payment_status === 'paid' || selectedOrder.payment_status === 'Paid (Demo)'
                        ? 'Set as Unpaid'
                        : 'Mark as Paid'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 text-xs">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>{selectedOrder.preferred_date || 'Today'} ({selectedOrder.preferred_time || 'Standard'})</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-500">Method: <strong>{selectedOrder.payment_method || 'COD'}</strong></span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      selectedOrder.payment_status === 'paid' || selectedOrder.payment_status === 'Paid (Demo)'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {selectedOrder.payment_status || 'Pending'}
                    </span>
                  </div>
                  {selectedOrder.payment_collected_at && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
                      Paid on {new Date(selectedOrder.payment_collected_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {selectedOrder.payment_collected_by_name ? ` • Processed by ${selectedOrder.payment_collected_by_name}` : ''}
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Preliminary Estimate:</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        ₱{parseFloat(String(selectedOrder.estimated_amount || selectedOrder.total_amount || 0)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Confirmed Final Bill:</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {selectedOrder.final_amount !== null && selectedOrder.final_amount !== undefined
                          ? `₱${parseFloat(String(selectedOrder.final_amount)).toFixed(2)}`
                          : 'Pending Weighing'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pickup and Delivery Addresses */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">
                  Logistics Addresses (Poblacion, Lagonglong)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 font-semibold block">Pickup Address:</span>
                    <p className="text-gray-800 dark:text-gray-200 flex items-start gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>{selectedOrder.pickup_address_text || 'Doorstep Pickup / Poblacion, Lagonglong'}</span>
                    </p>
                    {selectedOrder.pickup_latitude && selectedOrder.pickup_longitude && (
                      <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                        <span className="bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                          Pickup Pin: {Number(selectedOrder.pickup_latitude).toFixed(5)}, {Number(selectedOrder.pickup_longitude).toFixed(5)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-400 font-semibold block">Delivery Address:</span>
                    <p className="text-gray-800 dark:text-gray-200 flex items-start gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{selectedOrder.delivery_address_text || selectedOrder.pickup_address_text || 'Poblacion, Lagonglong'}</span>
                    </p>
                  </div>
                </div>
                {selectedOrder.special_instructions && (
                  <div className="text-xs text-gray-500 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                    <strong>Special Instructions:</strong> {selectedOrder.special_instructions}
                  </div>
                )}
              </div>

              {/* Assigned Driver Information */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">
                    Driver Logistics
                  </span>
                  {/* Driver re-assignment button */}
                  {(selectedOrder.status === 'Approved' || selectedOrder.status === 'Awaiting Pickup Assignment' || selectedOrder.status === 'Ready for Delivery') && (
                    <button
                      onClick={() => openAssignDriverModal(selectedOrder.status === 'Ready for Delivery' ? 'delivery' : 'pickup')}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      {selectedOrder.status === 'Ready for Delivery' ? 'Assign Delivery Driver' : 'Assign Pickup Driver'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-gray-400 font-semibold block text-[10px]">Pickup Driver</span>
                    {selectedOrder.pickup_driver_name ? (
                      <div className="mt-1 space-y-0.5">
                        <span className="font-bold text-gray-900 dark:text-white block">{selectedOrder.pickup_driver_name}</span>
                        <span className="text-[11px] text-gray-500 font-mono">{selectedOrder.pickup_driver_phone || 'No phone'}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic mt-1 block">No pickup driver assigned</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-gray-400 font-semibold block text-[10px]">Delivery Driver</span>
                    {selectedOrder.delivery_driver_name ? (
                      <div className="mt-1 space-y-0.5">
                        <span className="font-bold text-gray-900 dark:text-white block">{selectedOrder.delivery_driver_name}</span>
                        <span className="text-[11px] text-gray-500 font-mono">{selectedOrder.delivery_driver_phone || 'No phone'}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic mt-1 block">No delivery driver assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Laundry Weighing & Multi-Load Pricing Breakdown */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">
                    Weighed Laundry & Pricing Breakdown
                  </span>
                  {selectedOrder.status === 'Laundry Received' && (
                    <button
                      onClick={openRecordWeightModal}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      Record / Update Weight
                    </button>
                  )}
                </div>

                {selectedOrder.actual_weight ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <div>
                        <span className="text-xs text-gray-500">Official Scale Weight:</span>
                        <div className="font-extrabold text-base text-gray-900 dark:text-white">
                          {selectedOrder.actual_weight} kg
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500">Loads:</span>
                        <div className="font-extrabold text-base text-blue-600">
                          {selectedOrder.load_count || 1} Load(s)
                        </div>
                      </div>
                    </div>

                    {/* Breakdown loads if multi-load or array */}
                    {Array.isArray(selectedOrder.load_details) && selectedOrder.load_details.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-gray-500 block">Load Allocation (Max 8 kg/load):</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedOrder.load_details.map((l: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs">
                              <span className="font-medium text-gray-800 dark:text-gray-200">
                                Load #{l.loadNumber}: <strong>{l.weight} kg</strong>
                              </span>
                              <span className="font-bold text-emerald-600">
                                ₱{parseFloat(String(l.price)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Customer Approval status */}
                    <div className="flex items-center gap-2 text-xs pt-1">
                      {selectedOrder.weight_approved_by_customer === 1 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          Customer explicitly approved load allocation on {selectedOrder.weight_approved_at ? new Date(selectedOrder.weight_approved_at).toLocaleString() : 'file'}
                        </span>
                      ) : selectedOrder.actual_weight > 8 ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                          <Clock className="w-4 h-4" />
                          Awaiting explicit customer approval
                        </span>
                      ) : (
                        <span className="text-gray-500 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Standard single load (under 8 kg) — no additional approval required
                        </span>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="p-3 text-center rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                    Laundry has not been officially weighed on the scale yet.
                  </div>
                )}
              </div>

              {/* Status History & Audit Trail */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">
                  Status History & Audit Trail
                </span>
                
                {selectedOrder.history && selectedOrder.history.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {selectedOrder.history.map((h) => (
                      <div key={h.id} className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-xs flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white">{h.status}</span>
                            {h.changed_by_name && (
                              <span className="text-[10px] text-gray-400">by {h.changed_by_name} ({h.changed_by_role})</span>
                            )}
                          </div>
                          {h.notes && <p className="text-gray-500 dark:text-gray-400 mt-0.5">{h.notes}</p>}
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(h.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">No previous history entries recorded.</span>
                )}
              </div>

            </div>

            {/* Modal Context-Sensitive Action Buttons Toolbar */}
            <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                
                {/* 1. STAGE: Pending Approval */}
                {(selectedOrder.status === 'Pending Approval' || selectedOrder.status === 'Pending Request') && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={actionInProgress}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                      Reject Request
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApproveOrder}
                      disabled={actionInProgress}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      Approve Request
                    </Button>
                  </>
                )}

                {/* 2. STAGE: Approved / Awaiting Pickup Assignment */}
                {(selectedOrder.status === 'Approved' || selectedOrder.status === 'Awaiting Pickup Assignment') && (
                  <Button
                    size="sm"
                    onClick={() => openAssignDriverModal('pickup')}
                    disabled={actionInProgress}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5"
                  >
                    <Truck className="w-4 h-4" />
                    Assign Pickup Driver
                  </Button>
                )}

                {/* 3. STAGE: Picked Up -> Confirm Physical Receipt */}
                {selectedOrder.status === 'Picked Up' && (
                  <Button
                    size="sm"
                    onClick={handleConfirmReceipt}
                    disabled={actionInProgress}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Laundry Received
                  </Button>
                )}

                {/* 4. STAGE: Laundry Received -> Record Laundry Weight */}
                {selectedOrder.status === 'Laundry Received' && (
                  <Button
                    size="sm"
                    onClick={openRecordWeightModal}
                    disabled={actionInProgress}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5"
                  >
                    <Scale className="w-4 h-4" />
                    Record Laundry Weight
                  </Button>
                )}

                {/* 4b. Send Price to Customer Button */}
                {selectedOrder.actual_weight && selectedOrder.actual_weight > 0 && selectedOrder.status !== 'Completed' && selectedOrder.status !== 'Delivered' && (
                  <Button
                    size="sm"
                    onClick={handleSendPriceToCustomer}
                    disabled={actionInProgress}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                  >
                    <DollarSign className="w-4 h-4" />
                    Send Price to Customer
                  </Button>
                )}

                {/* 5. STAGE: Processing -> Advance Stage or Mark as Ready */}
                {selectedOrder.status === 'Processing' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {(!selectedOrder.processing_stage || selectedOrder.processing_stage === 'Washing') && (
                      <Button
                        size="sm"
                        onClick={() => handleAdvanceProcessingStage('Drying')}
                        disabled={actionInProgress}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Advance to Drying
                      </Button>
                    )}
                    {selectedOrder.processing_stage === 'Drying' && (
                      <Button
                        size="sm"
                        onClick={() => handleAdvanceProcessingStage('Folding')}
                        disabled={actionInProgress}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Advance to Folding
                      </Button>
                    )}
                    {selectedOrder.processing_stage === 'Folding' && (
                      <Button
                        size="sm"
                        onClick={() => handleAdvanceProcessingStage('Quality Check')}
                        disabled={actionInProgress}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Advance to Quality Check
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleMarkReady(selectedOrder.id)}
                      disabled={actionInProgress}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark as Ready
                    </Button>
                  </div>
                )}

                {/* 6. STAGE: Ready for Pickup/Delivery -> Assign Delivery Driver or Mark Completed */}
                {(selectedOrder.status === 'Ready for Pickup/Delivery' || selectedOrder.status === 'Ready for Delivery' || selectedOrder.status === 'Ready' || selectedOrder.status === 'Customer Pickup') && (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedOrder.customer_choice !== 'self_pickup' && (
                      <Button
                        size="sm"
                        onClick={() => openAssignDriverModal('delivery')}
                        disabled={actionInProgress}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5"
                      >
                        <Truck className="w-4 h-4" />
                        Assign Delivery Driver
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleCompleteOrder(selectedOrder.id)}
                      disabled={actionInProgress}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark as Completed
                    </Button>
                  </div>
                )}

                {/* 7. STAGE: Out for Delivery or Delivered -> Confirm & Complete */}
                {(selectedOrder.status === 'Delivered' || selectedOrder.status === 'Out for Delivery') && (
                  <Button
                    size="sm"
                    onClick={() => handleCompleteOrder(selectedOrder.id)}
                    disabled={actionInProgress}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Complete
                  </Button>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRIVER ASSIGNMENT MODAL (Worker Approval and Assignment Flow) */}
      {/* ========================================================================= */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Assign {assignTaskType === 'pickup' ? 'Pickup' : 'Delivery'} Driver
              </h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Select an available driver for order <span className="font-bold text-gray-900 dark:text-white">{selectedOrder?.order_number}</span>. Drivers with lower active workloads are shown first.
            </p>

            {/* Search Drivers */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search driver by name..."
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
              />
            </div>

            {/* Drivers List */}
            {loadingDrivers ? (
              <div className="py-10 text-center text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                <p className="text-xs">Loading available drivers...</p>
              </div>
            ) : availableDrivers.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No active drivers registered in the system.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                {availableDrivers
                  .filter((d) => d.name.toLowerCase().includes(driverSearch.toLowerCase()))
                  .map((driver) => {
                    const totalWorkload = (driver.active_pickups || 0) + (driver.active_deliveries || 0);
                    const isSelected = selectedDriverId === driver.id;

                    return (
                      <div
                        key={driver.id}
                        onClick={() => setSelectedDriverId(driver.id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                            : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-sm text-gray-900 dark:text-white block">
                            {driver.name}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {driver.phone || driver.email}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            totalWorkload === 0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {totalWorkload} active task(s)
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignModalOpen(false)}
                className="w-1/2"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAssignDriverSubmit}
                disabled={submittingAssign || !selectedDriverId}
                className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {submittingAssign ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD WEIGHT & AUTOMATIC PRICING MODAL (Exact rules & multi-load preview) */}
      {/* ========================================================================= */}
      {weightModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                Record Scale Weight & Pricing
              </h3>
              <button onClick={() => setWeightModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordWeightSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">
                  Measured Weight from Scale (kg)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="100"
                  required
                  placeholder="e.g. 6.0, 8.0, 12.0, 14.0"
                  value={scaleWeight}
                  onChange={(e) => handleScaleWeightChange(e.target.value)}
                  className="w-full h-11 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base font-extrabold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Reactive Live Multi-Load Calculation Preview */}
              {livePricing && (
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  livePricing.isOverweight 
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' 
                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                      Calculated: ₱{livePricing.totalAmount.toFixed(2)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      livePricing.isOverweight ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                    }`}>
                      {livePricing.loadCount} Load(s)
                    </span>
                  </div>

                  {/* Load list */}
                  <div className="space-y-1.5 pt-1 border-t border-gray-200 dark:border-gray-700">
                    {livePricing.loads.map((l) => (
                      <div key={l.loadNumber} className="flex justify-between items-center text-xs">
                        <span className="text-gray-700 dark:text-gray-300">
                          Load #{l.loadNumber} ({l.weight} kg):
                        </span>
                        <strong className="text-gray-900 dark:text-white">₱{l.price.toFixed(2)}</strong>
                      </div>
                    ))}
                  </div>

                  {livePricing.isOverweight && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                      ⚠️ <strong>Overweight Notice:</strong> Weight exceeds 8 kg. Submitting will set status to <em>Awaiting Customer Approval</em> for the customer to confirm the multi-load pricing.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Internal Audit Note</label>
                <input
                  type="text"
                  placeholder="e.g. Weighed on Scale #1 by laundry worker"
                  value={weightNotes}
                  onChange={(e) => setWeightNotes(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWeightModalOpen(false)}
                  className="w-1/2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingWeight || !livePricing}
                  className="w-1/2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {submittingWeight ? 'Saving...' : 'Save & Calculate'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REJECT ORDER MODAL (Worker required rejection reason) */}
      {/* ========================================================================= */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-base text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Reject Laundry Request
              </h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Please select or provide a reason for rejecting order <span className="font-bold text-gray-900 dark:text-white">{selectedOrder?.order_number}</span>. The customer will be notified with this reason.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Select Reason</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <option value="Service area unavailable or capacity full">Service area unavailable or capacity full</option>
                  <option value="Customer pickup location inaccessible">Customer pickup location inaccessible</option>
                  <option value="Requested laundry items violate shop policies">Requested laundry items violate shop policies</option>
                  <option value="Severe weather / shop maintenance today">Severe weather / shop maintenance today</option>
                  <option value="Other">Other custom reason...</option>
                </select>
              </div>

              {rejectionReason === 'Other' && (
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 dark:text-gray-300">Specify Reason</label>
                  <textarea
                    rows={2}
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    placeholder="Provide details for customer..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                    required
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectModalOpen(false)}
                  className="w-1/2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingReject}
                  className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Specific Chat Modal */}
      {chatOrder && (
        <OrderChatModal
          orderId={chatOrder.id}
          orderNumber={chatOrder.order_number}
          onClose={() => setChatOrder(null)}
        />
      )}

      {/* Accessible Action Confirmation & Feedback Modal */}
      {confirmModalConfig && (
        <ConfirmModal {...confirmModalConfig} />
      )}

      {/* Add Walk-in Customer Laundry Modal */}
      <AddCustomerLaundryModal
        isOpen={isAddLaundryModalOpen}
        onClose={() => setIsAddLaundryModalOpen(false)}
        onSuccess={(result: any) => {
          fetchOrdersAndCounts();
          setFeedbackModal({
            isOpen: true,
            type: 'success',
            title: 'Walk-in Laundry Saved',
            message: `Walk-in laundry ${result?.order?.order_number || ''} successfully registered! Initial status is set to Pending and payment to ${result?.order?.payment_status?.toUpperCase() || 'UNPAID'}.`
          });
        }}
        onError={(errorMsg: string) => {
          setFeedbackModal({
            isOpen: true,
            type: 'error',
            title: 'Failed to Save Walk-in Laundry',
            message: errorMsg || 'An error occurred while saving the walk-in transaction.'
          });
        }}
      />

      {/* Universal Transaction Feedback Modal */}
      <TransactionFeedbackModal
        isOpen={feedbackModal.isOpen}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onClose={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
        onTryAgain={feedbackModal.onTryAgain}
      />

    </div>
  );
}
