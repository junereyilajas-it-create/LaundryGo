import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, Search, Plus, Calendar, Clock, MapPin, 
  Truck, MessageSquare, CreditCard, ChevronRight, CheckCircle2, 
  RotateCw, AlertTriangle, Eye, X, Filter, Sparkles, Navigation,
  Scale, Layers, ShieldAlert, Check, ThumbsUp, ThumbsDown, DollarSign,
  User, Phone, Info
} from 'lucide-react';
import api from '../../services/api';
import { Button } from '../../components/ui';
import RequestServiceModal from '../../components/common/RequestServiceModal';
import OrderChatModal from '../../components/common/OrderChatModal';
import MapComponent from '../../components/map/MapComponent';
import ConfirmModal, { type ConfirmModalProps } from '../../components/common/ConfirmModal';
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
  service_type: string;
  service_name?: string;
  estimated_weight?: number;
  actual_weight?: number;
  load_count?: number;
  load_details?: string | LoadDetail[];
  total_amount?: number;
  estimated_amount?: number;
  final_amount?: number;
  status: string;
  processing_stage?: string;
  payment_status: string;
  payment_method?: string;
  preferred_date?: string;
  preferred_time?: string;
  pickup_address_text?: string;
  delivery_address_text?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  weight_recorded_by?: number;
  weight_recorded_by_name?: string;
  weight_recorded_at?: string;
  pickup_confirmed_by?: number;
  pickup_confirmed_by_name?: string;
  pickup_confirmer_name?: string;
  pickup_confirmed_at?: string;
  delivery_confirmed_by?: number;
  delivery_confirmed_by_name?: string;
  delivery_confirmed_at?: string;
  weight_approved_by_customer?: number | null;
  rejection_reason?: string;
  created_at: string;
  pickup_status?: string;
  pickup_driver_name?: string;
  pickup_driver_phone?: string;
  delivery_status?: string;
  delivery_driver_name?: string;
  delivery_driver_phone?: string;
  is_walkin?: boolean | number;
  customer_choice?: string;
  processing_started_at?: string;
  ready_at?: string;
  completed_at?: string;
  payment_collected_by?: number;
  payment_collected_at?: string;
  payment_collected_by_name?: string;
  history?: StatusHistoryItem[];
  payments?: any[];
}

export default function CustomerOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  // Request Service Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Order Chat Modal
  const [chatOrder, setChatOrder] = useState<{ id: number; order_number: string } | null>(null);

  // Delivery Request Modal
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<Order | null>(null);
  const [deliveryAddressInput, setDeliveryAddressInput] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // Order Details Modal
  const [detailsModalOrder, setDetailsModalOrder] = useState<Order | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [orderLoadError, setOrderLoadError] = useState<string | null>(null);

  // Overweight Proposal Modal State
  const [proposalModalOrder, setProposalModalOrder] = useState<Order | null>(null);
  const [confirmApprovalChecked, setConfirmApprovalChecked] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Accessible Confirmation / Notice Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<ConfirmModalProps | null>(null);

  // Universal Transaction Feedback Modal State
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

  // Ready Order Fulfillment Choice Modal State (Delivery vs Self-Pickup)
  const [fulfillmentModalOrder, setFulfillmentModalOrder] = useState<Order | null>(null);
  const [selectedFulfillmentChoice, setSelectedFulfillmentChoice] = useState<'delivery' | 'self_pickup'>('delivery');
  const [fulfillmentAddressInput, setFulfillmentAddressInput] = useState('');

  const openOrderDetailsById = async (orderId: number) => {
    setLoadingOrderDetails(true);
    setOrderLoadError(null);
    try {
      const res = await api.get(`/orders/${orderId}`);
      setDetailsModalOrder(res.data);
    } catch (err: any) {
      console.error('Error fetching order details:', err);
      setOrderLoadError(err.response?.data?.message || 'Failed to load order details. Please verify your permissions or try again.');
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const openOrderDetails = async (order: Order) => {
    setDetailsModalOrder(order);
    setLoadingOrderDetails(true);
    setOrderLoadError(null);
    try {
      const res = await api.get(`/orders/${order.id}`);
      setDetailsModalOrder(res.data);
    } catch (err: any) {
      console.error('Error fetching complete order details:', err);
      setOrderLoadError(err.response?.data?.message || 'Failed to refresh latest order progress from server.');
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const closeOrderDetails = () => {
    setDetailsModalOrder(null);
    setOrderLoadError(null);
    if (searchParams.get('orderId')) {
      searchParams.delete('orderId');
      setSearchParams(searchParams);
    }
  };

  // Check URL param if request modal or specific order should be opened on arrival
  useEffect(() => {
    if (searchParams.get('request') === 'true') {
      setIsRequestModalOpen(true);
      searchParams.delete('request');
      setSearchParams(searchParams);
    }

    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      const numId = parseInt(orderIdParam, 10);
      if (!isNaN(numId)) {
        openOrderDetailsById(numId);
      }
    }
  }, [searchParams]);

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await api.get('/orders');
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Real-time automatic background polling every 5 seconds
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);


  const handleCancelOrder = (orderId: number, orderNumber: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Cancel Order',
      message: (
        <div className="space-y-2">
          <p>Are you sure you want to cancel order <strong className="text-gray-900 dark:text-white">{orderNumber}</strong>?</p>
          <p className="text-xs text-red-500 font-semibold">This action cannot be undone once cancelled.</p>
        </div>
      ),
      confirmText: 'Cancel Order',
      variant: 'danger',
      onClose: () => setConfirmModalConfig(null),
      onConfirm: async () => {
        setConfirmModalConfig(null);
        try {
          await api.put(`/orders/${orderId}/cancel`);
          fetchOrders();
          if (detailsModalOrder?.id === orderId) {
            setDetailsModalOrder(null);
          }
          setConfirmModalConfig({
            isOpen: true,
            title: 'Order Cancelled',
            message: `Order ${orderNumber} has been successfully cancelled.`,
            confirmText: 'OK',
            cancelText: '',
            variant: 'info',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        } catch (err: any) {
          setConfirmModalConfig({
            isOpen: true,
            title: 'Action Failed',
            message: err.response?.data?.message || 'Failed to cancel order.',
            confirmText: 'Close',
            cancelText: '',
            variant: 'danger',
            onClose: () => setConfirmModalConfig(null),
            onConfirm: () => setConfirmModalConfig(null)
          });
        }
      }
    });
  };

  const handleRequestDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalOrder) return;
    setSubmittingDelivery(true);
    try {
      await api.post(`/orders/${deliveryModalOrder.id}/delivery`, {
        delivery_address_text: deliveryAddressInput || deliveryModalOrder.delivery_address_text,
        delivery_date: new Date().toISOString().split('T')[0],
        delivery_time: 'Afternoon'
      });
      setDeliveryModalOrder(null);
      fetchOrders();
      setConfirmModalConfig({
        isOpen: true,
        title: 'Delivery Scheduled',
        message: 'Delivery scheduled successfully! A driver will be assigned soon to deliver your clean laundry.',
        confirmText: 'Great!',
        cancelText: '',
        variant: 'success',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } catch (err: any) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Error Scheduling Delivery',
        message: err.response?.data?.message || 'Error scheduling delivery',
        confirmText: 'Close',
        cancelText: '',
        variant: 'danger',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Customer Fulfillment Selection Handler (Delivery vs Self-Pickup)
  const handleSelectFulfillment = async (orderId: number, choice: 'delivery' | 'self_pickup', address?: string) => {
    setSubmittingDelivery(true);
    try {
      await api.post(`/orders/${orderId}/select-fulfillment`, {
        choice,
        delivery_address_text: address
      });
      setFulfillmentModalOrder(null);
      fetchOrders();
      if (detailsModalOrder?.id === orderId) {
        openOrderDetailsById(orderId);
      }
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: choice === 'delivery' ? 'Delivery Selected' : 'Self-Pickup Selected',
        message: choice === 'delivery'
          ? 'Your laundry will be delivered to your address! Our dispatch team and driver will handle delivery.'
          : 'Your laundry is ready for pickup! You can visit our shop at your convenience to collect your items.'
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Fulfillment Selection Failed',
        message: err.response?.data?.message || 'Could not record fulfillment option. Please try again.',
        onTryAgain: () => handleSelectFulfillment(orderId, choice, address)
      });
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Customer Weight Proposal Decision (Approve / Reject)
  const handleCustomerWeightDecision = async (decision: 'approve' | 'reject') => {
    if (!proposalModalOrder) return;
    setSubmittingDecision(true);

    try {
      const payload: any = { decision };
      if (decision === 'reject') {
        payload.rejection_reason = rejectReasonInput.trim() || 'Declined additional multi-load charges';
      }

      const res = await api.put(`/orders/${proposalModalOrder.id}/customer-weight-decision`, payload);
      const savedOrder = proposalModalOrder;
      setProposalModalOrder(null);
      setShowRejectForm(false);
      setConfirmApprovalChecked(false);
      setRejectReasonInput('');
      fetchOrders();
      if (detailsModalOrder?.id === savedOrder.id) {
        openOrderDetails(savedOrder);
      }
      setConfirmModalConfig({
        isOpen: true,
        title: decision === 'approve' ? 'Proposal Approved' : 'Proposal Rejected',
        message: res.data.message,
        confirmText: 'Understood',
        cancelText: '',
        variant: decision === 'approve' ? 'success' : 'info',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } catch (err: any) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Submission Failed',
        message: err.response?.data?.message || 'Failed to submit decision.',
        confirmText: 'Close',
        cancelText: '',
        variant: 'danger',
        onClose: () => setConfirmModalConfig(null),
        onConfirm: () => setConfirmModalConfig(null)
      });
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Status mapping and stage styling
  const getNormalizedStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending Approval':
      case 'Pending Request':
        return 'Pending Approval';
      case 'Approved':
      case 'Awaiting Pickup Assignment':
        return 'Approved';
      case 'Driver Assigned':
        return 'Driver Assigned';
      case 'Pickup in Progress':
      case 'Picked Up':
        return 'Pickup in Progress';
      case 'Laundry Received':
        return 'Laundry Received';
      case 'Weighing and Pricing':
        return 'Weighing and Pricing';
      case 'Awaiting Customer Approval':
      case 'Awaiting Customer Confirmation':
        return 'Awaiting Customer Confirmation';
      case 'Processing':
      case 'Washing':
      case 'Drying':
      case 'Folding':
      case 'Quality Check':
        return 'Processing';
      case 'Ready for Pickup/Delivery':
      case 'Ready for Delivery':
      case 'Ready':
        return 'Ready for Pickup/Delivery';
      case 'Customer Pickup':
        return 'Ready for Pickup';
      case 'Out for Delivery':
      case 'Delivery Assigned':
        return 'Out for Delivery';
      case 'Completed':
      case 'Delivered':
        return 'Completed';
      case 'Cancelled':
      case 'Customer Rejected Weight Proposal':
      case 'Rejected':
        return 'Rejected or Cancelled';
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    const norm = getNormalizedStatusLabel(status);
    switch (norm) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200';
      case 'Out for Delivery':
      case 'Pickup in Progress':
      case 'Driver Assigned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200';
      case 'Processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 animate-pulse';
      case 'Ready for Pickup/Delivery':
      case 'Ready for Pickup':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200';
      case 'Awaiting Customer Confirmation':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300 animate-pulse';
      case 'Rejected or Cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200';
      case 'Approved':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200';
      case 'Weighing and Pricing':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200';
      case 'Pending Approval':
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200';
    }
  };

  // 12 Logical Stages Definition
  const get12StagesProgress = (order: Order) => {
    const isCancelled = order.status === 'Cancelled';
    const isRejected = order.status === 'Customer Rejected Weight Proposal' || order.status === 'Rejected';
    
    // Find history timestamp helper
    const getHistTime = (keyword: string) => {
      if (!order.history) return null;
      const found = order.history.find(h => h.status.toLowerCase().includes(keyword.toLowerCase()));
      return found ? new Date(found.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
    };

    const hasActualWeight = parseFloat(String(order.actual_weight || 0)) > 0;
    const isOverweight = parseFloat(String(order.actual_weight || 0)) > 8 || (order.load_count || 1) > 1;
    const customerConfirmedWeight = order.weight_approved_by_customer === 1;
    const hasDriver = !!order.pickup_driver_name || !!order.pickup_driver_phone;

    // Step 1: Request Submitted
    const s1_done = true;
    const s1_time = new Date(order.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Step 2: Pending Approval
    const isPending = order.status === 'Pending Approval' || order.status === 'Pending Request';
    const s2_done = !isCancelled && !isRejected && !isPending;
    const s2_current = isPending;

    // Step 3: Request Approved
    const isApprovedState = order.status === 'Approved' || order.status === 'Awaiting Pickup Assignment';
    const s3_done = !isCancelled && !isRejected && s2_done && (!isApprovedState || hasDriver || order.status === 'Driver Assigned' || order.status === 'Pickup in Progress' || order.status === 'Picked Up' || order.status === 'Laundry Received' || hasActualWeight || order.status === 'Processing' || order.status === 'Ready for Delivery' || order.status === 'Delivered' || order.status === 'Completed');
    const s3_current = !isCancelled && !isRejected && isApprovedState && !hasDriver;
    const s3_time = order.approved_at ? new Date(order.approved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : getHistTime('Approved');

    // Step 4: Driver Assigned
    const s4_done = !isCancelled && !isRejected && (order.status === 'Pickup in Progress' || order.status === 'Picked Up' || order.status === 'Laundry Received' || hasActualWeight || order.status === 'Processing' || order.status === 'Ready for Delivery' || order.status === 'Out for Delivery' || order.status === 'Delivered' || order.status === 'Completed');
    const s4_current = !isCancelled && !isRejected && (order.status === 'Driver Assigned' || (isApprovedState && hasDriver));
    const s4_time = getHistTime('Driver Assigned') || (hasDriver ? s3_time : null);

    // Step 5: Pickup in Progress
    const isPickupProgress = order.status === 'Pickup in Progress' || order.status === 'Picked Up' || order.pickup_status === 'in_progress';
    const s5_done = !isCancelled && !isRejected && (order.status === 'Laundry Received' || hasActualWeight || order.status === 'Processing' || order.status === 'Ready for Delivery' || order.status === 'Out for Delivery' || order.status === 'Delivered' || order.status === 'Completed');
    const s5_current = !isCancelled && !isRejected && isPickupProgress && !s5_done;
    const s5_time = order.pickup_confirmed_at ? new Date(order.pickup_confirmed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : getHistTime('Pickup');

    // Step 6: Laundry Received
    const s6_done = !isCancelled && !isRejected && (hasActualWeight || order.status === 'Weighing and Pricing' || order.status === 'Awaiting Customer Confirmation' || order.status === 'Awaiting Customer Approval' || order.status === 'Processing' || order.status === 'Ready for Delivery' || order.status === 'Out for Delivery' || order.status === 'Delivered' || order.status === 'Completed');
    const s6_current = !isCancelled && !isRejected && order.status === 'Laundry Received' && !hasActualWeight;
    const s6_time = order.pickup_confirmed_at ? new Date(order.pickup_confirmed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : getHistTime('Received');

    // Step 7: Weighing and Pricing
    const s7_done = !isCancelled && !isRejected && hasActualWeight;
    const s7_current = !isCancelled && !isRejected && (order.status === 'Weighing and Pricing' || (order.status === 'Laundry Received' && !hasActualWeight));
    const s7_time = order.weight_recorded_at ? new Date(order.weight_recorded_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : getHistTime('Weight');

    // Step 8: Awaiting Customer Confirmation
    const isAwaitingCust = order.status === 'Awaiting Customer Confirmation' || order.status === 'Awaiting Customer Approval';
    const s8_attention = !isCancelled && !isRejected && isAwaitingCust;
    const s8_done = !isCancelled && !isRejected && hasActualWeight && (!isOverweight || customerConfirmedWeight || order.status === 'Processing' || order.status === 'Ready for Delivery' || order.status === 'Out for Delivery' || order.status === 'Delivered' || order.status === 'Completed');
    const s8_current = s8_attention;
    const s8_time = getHistTime('Confirmation') || getHistTime('Proposal') || (customerConfirmedWeight ? getHistTime('Processing') : null);

    // Step 9: Laundry Processing
    const isProcessing = order.status === 'Processing' || !!order.processing_stage;
    const s9_done = !isCancelled && !isRejected && (order.status === 'Ready for Delivery' || order.status === 'Ready' || order.status === 'Out for Delivery' || order.status === 'Delivery Assigned' || order.status === 'Delivered' || order.status === 'Completed');
    const s9_current = !isCancelled && !isRejected && isProcessing && !s9_done;
    const s9_time = getHistTime('Processing');

    // Step 10: Ready for Delivery
    const isReady = order.status === 'Ready for Delivery' || order.status === 'Ready';
    const s10_done = !isCancelled && !isRejected && (order.status === 'Out for Delivery' || order.status === 'Delivery Assigned' || order.status === 'Delivered' || order.status === 'Completed');
    const s10_current = !isCancelled && !isRejected && isReady && !s10_done;
    const s10_time = getHistTime('Ready');

    // Step 11: Out for Delivery
    const isOutForDel = order.status === 'Out for Delivery' || order.status === 'Delivery Assigned' || order.delivery_status === 'in_progress';
    const s11_done = !isCancelled && !isRejected && (order.status === 'Delivered' || order.status === 'Completed');
    const s11_current = !isCancelled && !isRejected && isOutForDel && !s11_done;
    const s11_time = getHistTime('Delivery');

    // Step 12: Completed
    const isDelivered = order.status === 'Delivered' || order.status === 'Completed';
    const s12_done = !isCancelled && !isRejected && isDelivered;
    const s12_current = s12_done;
    const s12_time = order.delivery_confirmed_at ? new Date(order.delivery_confirmed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : getHistTime('Delivered');

    return [
      {
        num: 1,
        label: 'Request Submitted',
        done: s1_done,
        current: false,
        requires_attention: false,
        time: s1_time,
        note: 'The customer successfully submitted the laundry request.',
        details: `${order.service_name || 'Wash & Fold'} • Doorstep Pickup`
      },
      {
        num: 2,
        label: 'Pending Approval',
        done: s2_done,
        current: s2_current,
        requires_attention: false,
        time: s1_time,
        note: "The request is waiting for the worker's decision.",
        details: 'Staff review and scheduling'
      },
      {
        num: 3,
        label: 'Request Approved',
        done: s3_done,
        current: s3_current,
        requires_attention: false,
        time: s3_time,
        note: 'The worker approved the laundry request.',
        details: order.approved_by_name ? `Approved by ${order.approved_by_name}` : 'Staff approval verified'
      },
      {
        num: 4,
        label: 'Driver Assigned',
        done: s4_done,
        current: s4_current,
        requires_attention: false,
        time: s4_time,
        note: 'An eligible driver was assigned for pickup.',
        details: order.pickup_driver_name ? `Driver: ${order.pickup_driver_name} (${order.pickup_driver_phone || 'Assigned'})` : 'Awaiting driver allocation'
      },
      {
        num: 5,
        label: 'Pickup in Progress',
        done: s5_done,
        current: s5_current,
        requires_attention: false,
        time: s5_time,
        note: 'The driver is handling the pickup from your address.',
        details: order.pickup_address_text || 'Poblacion, Lagonglong'
      },
      {
        num: 6,
        label: 'Laundry Received',
        done: s6_done,
        current: s6_current,
        requires_attention: false,
        time: s6_time,
        note: 'The laundry has been received at the facility by the worker.',
        details: order.pickup_confirmer_name ? `Verified by ${order.pickup_confirmer_name}` : 'Checked in at laundry facility'
      },
      {
        num: 7,
        label: 'Weighing and Pricing',
        done: s7_done,
        current: s7_current,
        requires_attention: false,
        time: s7_time,
        note: 'The worker records the actual weight and calculates the cost.',
        details: hasActualWeight ? `Actual Weight: ${order.actual_weight} kg • Bill: ₱${parseFloat(String(order.total_amount || 0)).toFixed(2)}` : 'Pending physical scale calibration'
      },
      {
        num: 8,
        label: 'Awaiting Customer Confirmation',
        done: s8_done,
        current: s8_current,
        requires_attention: s8_attention,
        time: s8_time,
        note: isOverweight
          ? (customerConfirmedWeight ? 'Customer confirmed revised multi-load arrangement.' : 'The customer must confirm the revised price or load arrangement.')
          : 'Standard load (<=8kg) — customer confirmation not required.',
        details: isOverweight ? `${order.load_count || 2} loads • ₱${parseFloat(String(order.total_amount || 0)).toFixed(2)}` : 'Standard single load pricing applied'
      },
      {
        num: 9,
        label: 'Laundry Processing',
        done: s9_done,
        current: s9_current,
        requires_attention: false,
        time: s9_time,
        note: 'Your laundry is now being processed. Please allow approximately 2 hours. We will notify you once your laundry is ready for pickup or delivery.',
        details: 'Washing, drying & folding combined in one processing status'
      },
      {
        num: 10,
        label: 'Ready for Pickup / Delivery',
        done: s10_done,
        current: s10_current,
        requires_attention: !order.customer_choice && (order.status === 'Ready for Pickup/Delivery' || order.status === 'Ready'),
        time: s10_time,
        note: 'Your laundry is ready. Choose delivery or self-pickup.',
        details: order.customer_choice === 'self_pickup' ? 'Self-Pickup selected at shop' : order.customer_choice === 'delivery' ? 'Delivery selected' : 'Cleaned & packaged. Awaiting fulfillment selection'
      },
      {
        num: 11,
        label: 'Out for Delivery',
        done: s11_done,
        current: s11_current,
        requires_attention: false,
        time: s11_time,
        note: 'The driver is delivering the laundry.',
        details: order.delivery_driver_name ? `Driver: ${order.delivery_driver_name} (${order.delivery_driver_phone || 'En route'})` : 'Awaiting delivery driver'
      },
      {
        num: 12,
        label: 'Completed',
        done: s12_done,
        current: s12_current,
        requires_attention: false,
        time: s12_time,
        note: 'The order has been completed.',
        details: 'Fulfillment completed and verified'
      }
    ];
  };


  const parseLoadDetails = (details: any): LoadDetail[] => {
    if (!details) return [];
    if (Array.isArray(details)) return details;
    try {
      return JSON.parse(details);
    } catch {
      return [];
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.service_name && o.service_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      o.status.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'active') {
      return matchesSearch && o.status !== 'Delivered' && o.status !== 'Completed' && o.status !== 'Cancelled' && o.status !== 'Customer Rejected Weight Proposal';
    }
    if (statusFilter === 'completed') {
      return matchesSearch && (o.status === 'Delivered' || o.status === 'Completed');
    }
    if (statusFilter === 'cancelled') {
      return matchesSearch && (o.status === 'Cancelled' || o.status === 'Customer Rejected Weight Proposal');
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            My Laundry
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track active requests, review load weights, and monitor dispatch in Poblacion, Lagonglong
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => fetchOrders()}
            variant="outline"
            className="gap-2 text-xs font-semibold"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          <Button
            onClick={() => setIsRequestModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Request Laundry Service
          </Button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        
        {/* Status Filter Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1 overflow-x-auto custom-scrollbar">
          {(['all', 'active', 'completed', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab === 'all' ? 'All Orders' : tab}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search order number, service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Order Cards List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
          <RotateCw className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Updating your laundry status in real-time...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No laundry orders found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters or search keyword.'
                : 'You have not submitted any laundry requests yet. Start fresh today!'}
            </p>
          </div>
          <Button
            onClick={() => setIsRequestModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            Request Laundry Service
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isOverweightPending = order.status === 'Awaiting Customer Approval' || order.status === 'Awaiting Customer Confirmation';
            const stages = get12StagesProgress(order);
            const activeStage = stages.slice().reverse().find(s => s.done || s.current) || stages[0];

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openOrderDetails(order)}
                className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm p-5 sm:p-6 transition-all space-y-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md ${
                  isOverweightPending 
                    ? 'border-rose-400 dark:border-rose-700 ring-2 ring-rose-500/20' 
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                {/* PROMINENT OVERWEIGHT ACTION BANNER */}
                {isOverweightPending && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-amber-950/30 border border-rose-300 dark:border-rose-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <Scale className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-rose-900 dark:text-rose-200">
                          Action Required: Laundry Exceeds 8 kg ({order.actual_weight} kg)
                        </h4>
                        <p className="text-[11px] sm:text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                          Proposed into {order.load_count || 2} loads for ₱{parseFloat(String(order.total_amount || 0)).toFixed(2)}. Please confirm to proceed.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setProposalModalOrder(order);
                        setConfirmApprovalChecked(false);
                        setShowRejectForm(false);
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 px-3.5 h-8 shadow-sm"
                    >
                      Review Proposal
                    </Button>
                  </div>
                )}

                {/* PROMINENT PROCESSING STATUS BANNER */}
                {order.status === 'Processing' && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-start gap-3 shadow-xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Clock className="w-4 h-4 animate-spin" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-blue-900 dark:text-blue-200">
                        Laundry Processing Started
                      </h4>
                      <p className="text-[11px] sm:text-xs text-blue-700 dark:text-blue-300 mt-0.5 leading-relaxed">
                        Your laundry is now being processed. Please allow approximately 2 hours. We will notify you once your laundry is ready for pickup or delivery.
                      </p>
                    </div>
                  </div>
                )}

                {/* PROMINENT READY FULFILLMENT BANNER */}
                {(order.status === 'Ready for Pickup/Delivery' || order.status === 'Ready' || order.status === 'Customer Pickup' || order.status === 'Ready for Delivery') && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-cyan-950/30 border border-teal-300 dark:border-teal-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-teal-900 dark:text-teal-200">
                          Your Laundry is Ready!
                        </h4>
                        <div className="text-[11px] sm:text-xs text-teal-800 dark:text-teal-300 mt-0.5">
                          {order.customer_choice === 'delivery' || order.status === 'Ready for Delivery' ? (
                            <span>Your laundry will be delivered to: <strong>{order.delivery_address_text || order.pickup_address_text || 'Your registered address'}</strong>.</span>
                          ) : order.customer_choice === 'self_pickup' || order.status === 'Customer Pickup' ? (
                            <span>Your laundry is ready for pickup! You may personally collect your laundry at the shop anytime.</span>
                          ) : (
                            <span>Your laundry is ready. Choose your preferred option: <strong>Delivery</strong> to your address or <strong>Self-Pickup</strong> at the shop.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!order.customer_choice && order.status !== 'Customer Pickup' && (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          onClick={() => {
                            setFulfillmentModalOrder(order);
                            setSelectedFulfillmentChoice('delivery');
                            setFulfillmentAddressInput(order.delivery_address_text || order.pickup_address_text || '');
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-3 gap-1 shadow-xs"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Delivery
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setFulfillmentModalOrder(order);
                            setSelectedFulfillmentChoice('self_pickup');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 gap-1 shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Self-Pickup
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Order Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-extrabold text-sm sm:text-base text-gray-900 dark:text-white">
                          {order.order_number}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(order.status)}`}>
                          {getNormalizedStatusLabel(order.status)}
                        </span>
                        {order.processing_stage && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                            Stage: {order.processing_stage}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>{order.service_name || 'Wash & Fold'}</span>
                        <span>•</span>
                        <span>Doorstep Pickup</span>
                        <span>•</span>
                        <span className="text-gray-400">
                          {order.preferred_date ? `${order.preferred_date} (${order.preferred_time || 'Afternoon'})` : new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Payment Badges & Amount */}
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                        {order.actual_weight ? 'Confirmed Total' : 'Estimated Total'}
                      </span>
                      <span className="text-base font-extrabold text-gray-900 dark:text-white">
                        ₱{parseFloat(String(order.total_amount || 0)).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                          order.payment_status === 'paid' || order.payment_status === 'Paid (Demo)'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}
                      >
                        {order.payment_status}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 uppercase">
                        {order.payment_method === 'GCASH_DEMO' ? 'GCash Demo' : order.payment_method || 'COD'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Transaction Information Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Pickup Location</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 truncate block mt-0.5" title={order.pickup_address_text || 'Poblacion, Lagonglong'}>
                      {order.pickup_address_text || 'Poblacion, Lagonglong'}
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Submitted: {new Date(order.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Weight Status</span>
                    <div className="mt-0.5 space-y-0.5">
                      <span className="text-gray-600 dark:text-gray-300 block">
                        Est: <strong>{order.estimated_weight ? `${order.estimated_weight} kg` : 'N/A'}</strong>
                      </span>
                      <span className="text-gray-900 dark:text-white font-bold block">
                        Actual: {order.actual_weight ? (
                          <span className="text-blue-600 dark:text-blue-400 font-extrabold">{order.actual_weight} kg</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">Pending Weighing</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Cost Breakdown</span>
                    <div className="mt-0.5 space-y-0.5">
                      <span className="text-gray-600 dark:text-gray-300 block">
                        Est: ₱{parseFloat(String(order.estimated_amount || order.total_amount || 0)).toFixed(2)}
                      </span>
                      <span className="text-gray-900 dark:text-white font-bold block">
                        Final: {order.final_amount !== null && order.final_amount !== undefined ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">₱{parseFloat(String(order.final_amount)).toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400 font-medium">Pending Final Bill</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Assigned Driver</span>
                    <div className="mt-0.5">
                      {order.delivery_driver_name || order.pickup_driver_name ? (
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white block">
                            {order.delivery_driver_name || order.pickup_driver_name}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500 block">
                            {order.delivery_driver_phone || order.pickup_driver_phone || 'Driver Assigned'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic block">Awaiting Driver Assignment</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Mini Bar */}
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
                    <span className="text-gray-500 dark:text-gray-400">Current Stage:</span>
                    <strong className="text-gray-900 dark:text-white">{activeStage.label}</strong>
                    {activeStage.time && (
                      <span className="text-[11px] text-gray-400">({activeStage.time})</span>
                    )}
                  </div>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-[11px] flex items-center gap-1">
                    Click to view full 12-step progress <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                {/* Card Action Buttons (Clicking card opens modal, but buttons can perform direct actions) */}
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="flex flex-wrap items-center justify-between gap-2 pt-1"
                >
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setChatOrder({ id: order.id, order_number: order.order_number })}
                      className="gap-1.5 text-xs font-semibold h-8"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                      Order Chat
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openOrderDetails(order)}
                      className="gap-1.5 text-xs font-semibold h-8"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Order Details
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Pay Now Button if Unpaid and Final Bill confirmed */}
                    {order.actual_weight && order.payment_status !== 'paid' && order.payment_status !== 'Paid (Demo)' && (
                      <Button
                        size="sm"
                        onClick={() => navigate('/customer/payments')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs font-bold h-8"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Pay Final Bill
                      </Button>
                    )}

                    {/* Schedule Delivery button if Ready */}
                    {(order.status === 'Ready for Delivery' || order.status === 'Ready') && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setDeliveryModalOrder(order);
                          setDeliveryAddressInput(order.delivery_address_text || order.pickup_address_text || '');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold h-8"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        Schedule Delivery
                      </Button>
                    )}

                    {/* Cancel Order if still Pending Approval */}
                    {(order.status === 'Pending Approval' || order.status === 'Pending Request') && (
                      <button
                        onClick={() => handleCancelOrder(order.id, order.order_number)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>
      )}

      {/* COMPREHENSIVE 12-STAGE ORDER DETAILS MODAL */}
      {detailsModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar flex flex-col space-y-5"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-lg sm:text-xl text-gray-900 dark:text-white">
                    {detailsModalOrder.order_number}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(detailsModalOrder.status)}`}>
                    {getNormalizedStatusLabel(detailsModalOrder.status)}
                  </span>
                  {detailsModalOrder.processing_stage && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                      Stage: {detailsModalOrder.processing_stage}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-2">
                  <span>Requested: {new Date(detailsModalOrder.created_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>•</span>
                  <span>Service: {detailsModalOrder.service_name || 'Wash & Fold'}</span>
                </p>
              </div>
              <button 
                onClick={closeOrderDetails} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Close Order Details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Refresh Status Banner */}
            {loadingOrderDetails && (
              <div className="py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-center text-xs text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                Synchronizing live order status and database progress...
              </div>
            )}

            {/* Error Message if order failed to load */}
            {orderLoadError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{orderLoadError}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openOrderDetails(detailsModalOrder)}
                  className="text-xs h-7 px-2.5"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Terminal Status / Rejection Banner if Present */}
            {(detailsModalOrder.status === 'Cancelled' || detailsModalOrder.status === 'Customer Rejected Weight Proposal' || detailsModalOrder.rejection_reason) && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-300 space-y-1.5">
                <div className="flex items-center gap-2 font-black text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Terminal Status: {detailsModalOrder.status === 'Cancelled' ? 'Order Cancelled' : 'Order Rejected / Discontinued'}</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Reason:</strong> {detailsModalOrder.rejection_reason || 'Order discontinued upon customer or staff action.'}
                </p>
                <p className="text-[11px] text-gray-500">
                  This transaction is closed. Subsequent fulfillment steps have been halted.
                </p>
              </div>
            )}

            {/* Processing Stage Banner in Modal */}
            {detailsModalOrder.status === 'Processing' && (
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                  Laundry Processing Started
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  Your laundry is now being processed. Please allow approximately 2 hours. We will notify you once your laundry is ready for pickup or delivery.
                </p>
              </div>
            )}

            {/* Ready for Pickup / Delivery Banner in Modal */}
            {(detailsModalOrder.status === 'Ready for Pickup/Delivery' || detailsModalOrder.status === 'Ready' || detailsModalOrder.status === 'Customer Pickup' || detailsModalOrder.status === 'Ready for Delivery') && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-cyan-950/30 border border-teal-300 dark:border-teal-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-teal-900 dark:text-teal-200">
                      Your Laundry is Ready!
                    </h4>
                    <div className="text-[11px] sm:text-xs text-teal-800 dark:text-teal-300 mt-0.5">
                      {detailsModalOrder.customer_choice === 'delivery' || detailsModalOrder.status === 'Ready for Delivery' ? (
                        <span>Your laundry will be delivered to: <strong>{detailsModalOrder.delivery_address_text || detailsModalOrder.pickup_address_text || 'Your address'}</strong>.</span>
                      ) : detailsModalOrder.customer_choice === 'self_pickup' || detailsModalOrder.status === 'Customer Pickup' ? (
                        <span>Your laundry is ready for pickup! You may personally collect your laundry at the shop.</span>
                      ) : (
                        <span>Your laundry is ready. Choose your preferred option: <strong>Delivery</strong> to your address or <strong>Self-Pickup</strong> at the shop.</span>
                      )}
                    </div>
                  </div>
                </div>

                {!detailsModalOrder.customer_choice && detailsModalOrder.status !== 'Customer Pickup' && (
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      onClick={() => {
                        setFulfillmentModalOrder(detailsModalOrder);
                        setSelectedFulfillmentChoice('delivery');
                        setFulfillmentAddressInput(detailsModalOrder.delivery_address_text || detailsModalOrder.pickup_address_text || '');
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-3 gap-1 shadow-xs"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Delivery
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setFulfillmentModalOrder(detailsModalOrder);
                        setSelectedFulfillmentChoice('self_pickup');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Self-Pickup
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 12-STEP STEP-BY-STEP LAUNDRY PROGRESS TRACKER */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>12-Step Laundry Fulfillment Progress</span>
                </h4>
                <span className="text-[11px] text-gray-400 font-medium">Real-time database tracking</span>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                {get12StagesProgress(detailsModalOrder).map((stg, idx, arr) => {
                  const isCompleted = stg.done;
                  const isCurrent = stg.current;
                  const isAttention = stg.requires_attention;

                  return (
                    <div 
                      key={stg.num}
                      className={`relative flex items-start gap-3.5 py-3 first:pt-1 last:pb-1 transition-colors rounded-xl px-2 ${
                        isAttention
                          ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800'
                          : isCurrent 
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shadow-sm' 
                          : isCompleted 
                          ? 'text-gray-900 dark:text-gray-100' 
                          : 'text-gray-400 opacity-60'
                      }`}
                    >
                      {/* Step Indicator Circle */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm ${
                          isAttention
                            ? 'bg-rose-600 text-white animate-bounce'
                            : isCompleted 
                            ? 'bg-emerald-600 text-white' 
                            : isCurrent 
                            ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 animate-pulse' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {isAttention ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : isCompleted ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            stg.num
                          )}
                        </div>
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-black text-xs sm:text-sm ${
                              isAttention ? 'text-rose-700 dark:text-rose-300' :
                              isCurrent ? 'text-blue-700 dark:text-blue-300 font-extrabold' : ''
                            }`}>
                              {stg.num}. {stg.label}
                            </span>
                            
                            {/* Status tag */}
                            {isAttention && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200 animate-pulse">
                                Requires Confirmation
                              </span>
                            )}
                            {isCurrent && !isAttention && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200">
                                Current Step
                              </span>
                            )}
                            {isCompleted && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Completed
                              </span>
                            )}
                          </div>

                          {stg.time && (
                            <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
                              {stg.time}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {stg.note}
                        </p>

                        {stg.details && (
                          <div className="mt-1 font-mono text-[11px] text-blue-700 dark:text-blue-300 bg-white/70 dark:bg-gray-900/60 inline-block px-2 py-0.5 rounded-lg border border-gray-200/60 dark:border-gray-800">
                            {stg.details}
                          </div>
                        )}

                        {/* Direct action if Step 8 requires attention */}
                        {isAttention && (
                          <div className="mt-2.5">
                            <Button
                              size="sm"
                              onClick={() => {
                                setProposalModalOrder(detailsModalOrder);
                                setConfirmApprovalChecked(false);
                                setShowRejectForm(false);
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-7 px-3 shadow-sm"
                            >
                              Review & Confirm Proposal
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmed Map Pin & Pickup Location */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Confirmed Pickup Location & Coordinates
              </h4>
              
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <MapComponent
                  initialPosition={[
                    detailsModalOrder.pickup_latitude || 8.8105,
                    detailsModalOrder.pickup_longitude || 124.7925
                  ]}
                  height="160px"
                  readOnly={true}
                />
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-1">
                <p className="font-bold text-gray-900 dark:text-white flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{detailsModalOrder.pickup_address_text || 'Poblacion, Lagonglong, Misamis Oriental'}</span>
                </p>
                <p className="font-mono text-[11px] text-gray-500 pl-5.5">
                  Coordinates: {detailsModalOrder.pickup_latitude ? Number(detailsModalOrder.pickup_latitude).toFixed(6) : '8.810500'}, {detailsModalOrder.pickup_longitude ? Number(detailsModalOrder.pickup_longitude).toFixed(6) : '124.792500'}
                </p>
              </div>
            </div>

            {/* Service & Pricing Details Card */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Service Details & Pricing Calculation
              </h4>

              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Service Package</span>
                  <span className="font-bold text-gray-900 dark:text-white">{detailsModalOrder.service_name || 'Wash & Fold'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Pickup Schedule</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{detailsModalOrder.preferred_date} • {detailsModalOrder.preferred_time || 'Afternoon'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Estimated Weight</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{detailsModalOrder.estimated_weight ? `${detailsModalOrder.estimated_weight} kg` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Actual Measured Weight</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {detailsModalOrder.actual_weight ? (
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                        {detailsModalOrder.actual_weight} kg ({detailsModalOrder.load_count || 1} load{(detailsModalOrder.load_count || 1) > 1 ? 's' : ''})
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Pending physical scale calibration</span>
                    )}
                  </span>
                </div>

                {/* Multi-load details if present */}
                {parseLoadDetails(detailsModalOrder.load_details).length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Multi-load Breakdown:</span>
                    {parseLoadDetails(detailsModalOrder.load_details).map((ld, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-gray-600 dark:text-gray-300">
                        <span>Load #{ld.loadNumber || i + 1} ({ld.weight} kg) - {ld.description || 'Wash & Fold'}</span>
                        <span className="font-mono font-semibold">₱{parseFloat(String(ld.price)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">
                      {detailsModalOrder.actual_weight ? 'Official Final Bill' : 'Estimated Bill'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {detailsModalOrder.actual_weight ? 'Calculated via calibrated scales & pricing rules' : 'Subject to actual weighing upon receipt'}
                    </span>
                  </div>
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                    ₱{parseFloat(String(detailsModalOrder.total_amount || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment & Logistics Personnel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block">Payment Information</span>
                <div className="flex justify-between">
                  <span className="text-gray-500">Method:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {detailsModalOrder.payment_method === 'GCASH_DEMO' ? 'GCash Demo Simulation' : 'Cash on Delivery (COD)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-bold uppercase text-[11px] ${
                    detailsModalOrder.payment_status === 'paid' || detailsModalOrder.payment_status === 'Paid (Demo)'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {detailsModalOrder.payment_status}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block">Assigned Drivers</span>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pickup Driver:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {detailsModalOrder.pickup_driver_name || 'Pending Assignment'}
                  </span>
                </div>
                {detailsModalOrder.pickup_driver_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pickup Contact:</span>
                    <a href={`tel:${detailsModalOrder.pickup_driver_phone}`} className="text-blue-600 font-mono hover:underline">
                      {detailsModalOrder.pickup_driver_phone}
                    </a>
                  </div>
                )}
                {detailsModalOrder.delivery_driver_name && (
                  <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500">Delivery Driver:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {detailsModalOrder.delivery_driver_name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* RAW DATABASE AUDIT HISTORY LOG */}
            {detailsModalOrder.history && detailsModalOrder.history.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center justify-between">
                  <span>Database Audit Log</span>
                  <span className="text-[11px] font-normal text-gray-400">{detailsModalOrder.history.length} recorded events</span>
                </h4>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto custom-scrollbar text-xs divide-y divide-gray-100 dark:divide-gray-800">
                  {detailsModalOrder.history.map((h, i) => (
                    <div key={h.id || i} className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white mr-2">{h.status}</span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">{h.notes || 'Status updated'}</span>
                        {h.changed_by_name && (
                          <span className="text-[10px] text-gray-400 block sm:inline sm:ml-2">
                            by {h.changed_by_name} ({h.changed_by_role || 'staff'})
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-gray-400 shrink-0">
                        {new Date(h.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              {/* If Order is Pending Approval, allow customer cancellation */}
              {(detailsModalOrder.status === 'Pending Approval' || detailsModalOrder.status === 'Pending Request') && (
                <Button
                  variant="outline"
                  onClick={() => handleCancelOrder(detailsModalOrder.id, detailsModalOrder.order_number)}
                  className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-9"
                >
                  Cancel Laundry Request
                </Button>
              )}

              {/* Pay Now Button if Unpaid and Final Bill confirmed */}
              {detailsModalOrder.actual_weight && detailsModalOrder.payment_status !== 'paid' && detailsModalOrder.payment_status !== 'Paid (Demo)' && (
                <Button
                  onClick={() => {
                    closeOrderDetails();
                    navigate('/customer/payments');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 gap-1"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Pay Final Bill (₱{parseFloat(String(detailsModalOrder.total_amount || 0)).toFixed(2)})
                </Button>
              )}

              <Button
                onClick={closeOrderDetails}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs"
              >
                Close Order Details
              </Button>
            </div>
          </motion.div>
        </div>
      )}


      {/* OVERWEIGHT PROPOSAL REVIEW MODAL */}
      {proposalModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 border border-rose-300 dark:border-rose-800 shadow-2xl space-y-5"
          >
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    Weight Confirmation Required
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    Order {proposalModalOrder.order_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProposalModalOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 space-y-1">
                <p className="font-semibold">
                  Your laundry weighs <strong className="text-rose-700 dark:text-rose-400">{proposalModalOrder.actual_weight} kg</strong>, which exceeds the standard 8 kg single-load capacity.
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  To ensure thorough washing, gentle care, and proper drying, our team proposes dividing your clothes into <strong>{proposalModalOrder.load_count || 2} separate loads</strong>.
                </p>
              </div>

              {/* Load allocation breakdown */}
              <div className="space-y-2">
                <span className="font-bold text-xs uppercase tracking-wider text-gray-500 block">
                  Proposed Multi-Load Division:
                </span>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  {parseLoadDetails(proposalModalOrder.load_details).map((load) => (
                    <div key={load.loadNumber} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-850">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">Load #{load.loadNumber}</span>
                          <span className="text-xs text-gray-500 block">{load.weight} kg load</span>
                        </div>
                      </div>
                      <span className="font-extrabold text-gray-900 dark:text-white">
                        ₱{parseFloat(String(load.price)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3.5 bg-blue-50 dark:bg-blue-950/40 font-bold text-sm">
                    <span className="text-gray-900 dark:text-white">Total Proposed Price:</span>
                    <span className="text-base text-blue-600 dark:text-blue-400">
                      ₱{parseFloat(String(proposalModalOrder.total_amount || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirmation checkbox */}
              {!showRejectForm ? (
                <div className="pt-2 space-y-3">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmApprovalChecked}
                      onChange={(e) => setConfirmApprovalChecked(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      I understand and approve dividing my laundry into {proposalModalOrder.load_count || 2} loads for the total price of <strong>₱{parseFloat(String(proposalModalOrder.total_amount || 0)).toFixed(2)}</strong>.
                    </span>
                  </label>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(true)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline font-semibold"
                    >
                      Decline Proposal
                    </button>

                    <Button
                      onClick={() => handleCustomerWeightDecision('approve')}
                      disabled={!confirmApprovalChecked || submittingDecision}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-10 px-5"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      {submittingDecision ? 'Saving...' : 'Approve & Start Washing'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-3 border border-gray-200 dark:border-gray-700">
                  <span className="font-bold text-xs text-gray-800 dark:text-gray-200 block">
                    Reason for Declining (Optional):
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Please return unwashed clothes, will wash at home"
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="px-3 py-1 text-xs text-gray-500"
                    >
                      Back
                    </button>
                    <Button
                      size="sm"
                      onClick={() => handleCustomerWeightDecision('reject')}
                      disabled={submittingDecision}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                    >
                      Confirm Decline
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Request Service Modal */}
      <RequestServiceModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onOrderCreated={() => fetchOrders()}
      />

      {/* Chat Modal */}
      {chatOrder && (
        <OrderChatModal
          onClose={() => setChatOrder(null)}
          orderId={chatOrder.id}
          orderNumber={chatOrder.order_number}
        />
      )}

      {/* Delivery Request Modal */}
      {deliveryModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                Schedule Clean Laundry Delivery
              </h3>
              <button onClick={() => setDeliveryModalOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestDeliverySubmit} className="py-4 space-y-4 text-xs sm:text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                Your clothes are ready! Confirm your delivery address in Poblacion, Lagonglong:
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-xs text-gray-700 dark:text-gray-300">Delivery Address</label>
                <input
                  type="text"
                  required
                  value={deliveryAddressInput}
                  onChange={(e) => setDeliveryAddressInput(e.target.value)}
                  className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeliveryModalOrder(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingDelivery}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {submittingDelivery ? 'Scheduling...' : 'Confirm Delivery'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Customer Fulfillment Choice Modal (Delivery vs Self-Pickup) */}
      {fulfillmentModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative space-y-5"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    How would you like to receive your laundry?
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">
                    Order {fulfillmentModalOrder.order_number}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setFulfillmentModalOrder(null)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300">
              Your laundry is ready! Please select whether you'd like your clean clothes delivered to your doorstep or if you prefer picking them up personally at our shop:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Delivery */}
              <div
                onClick={() => setSelectedFulfillmentChoice('delivery')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                  selectedFulfillmentChoice === 'delivery'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <input
                    type="radio"
                    name="fulfillment_choice"
                    checked={selectedFulfillmentChoice === 'delivery'}
                    onChange={() => setSelectedFulfillmentChoice('delivery')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Doorstep Delivery</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  A driver will deliver the laundry directly to your specified address.
                </p>
              </div>

              {/* Option 2: Self-Pickup */}
              <div
                onClick={() => setSelectedFulfillmentChoice('self_pickup')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                  selectedFulfillmentChoice === 'self_pickup'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <input
                    type="radio"
                    name="fulfillment_choice"
                    checked={selectedFulfillmentChoice === 'self_pickup'}
                    onChange={() => setSelectedFulfillmentChoice('self_pickup')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Self-Pickup</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Personally collect your fresh laundry at the LaundriGo laundry shop.
                </p>
              </div>
            </div>

            {/* If Delivery chosen, prompt address confirmation */}
            {selectedFulfillmentChoice === 'delivery' && (
              <div className="space-y-1.5 pt-1">
                <label className="font-semibold text-xs text-gray-700 dark:text-gray-300">
                  Confirm Delivery Address (Poblacion, Lagonglong)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zone 2, Poblacion, Lagonglong"
                  value={fulfillmentAddressInput}
                  onChange={(e) => setFulfillmentAddressInput(e.target.value)}
                  className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFulfillmentModalOrder(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submittingDelivery || (selectedFulfillmentChoice === 'delivery' && !fulfillmentAddressInput.trim())}
                onClick={() => handleSelectFulfillment(
                  fulfillmentModalOrder.id,
                  selectedFulfillmentChoice,
                  fulfillmentAddressInput.trim()
                )}
                className={`font-bold text-white shadow-sm ${
                  selectedFulfillmentChoice === 'delivery'
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                }`}
              >
                {submittingDelivery ? 'Saving...' : 'Confirm Choice'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Accessible Confirmation / Notice Modal */}
      {confirmModalConfig && (
        <ConfirmModal {...confirmModalConfig} />
      )}

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
