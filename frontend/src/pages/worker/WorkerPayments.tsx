import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  DollarSign, Search, Edit, Eye, Plus, X, Printer, Calendar, 
  User, FileText, CheckCircle2, Clock, AlertTriangle, RefreshCw, 
  Layers, Package, ShieldCheck, Tag
} from 'lucide-react';
import ReceiptModal from '../../components/common/ReceiptModal';
import StatusBadge from '../../components/common/StatusBadge';

interface Order {
  id: number;
  order_number: string;
  total_amount: number;
}

interface PaymentItem {
  id: number;
  payment_id?: number | null;
  order_id: number;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  service_name?: string;
  order_status?: string;
  estimated_amount?: number | string | null;
  final_amount?: number | string | null;
  total_amount?: number | string;
  amount: number | string;
  payment_method: string;
  payment_status: string;
  reference_number?: string;
  payment_date?: string | null;
  created_at: string;
  order_created_at?: string;
  is_demo?: number | boolean;
  collector_name?: string;
}

const PAYMENT_METHODS = ['cash', 'gcash', 'bank_transfer', 'cod'];

const FILTER_STATUSES = [
  { id: 'all', label: 'All Payments' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Paid' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
];

export default function WorkerPayments() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<any | null>(null);
  const [detailsPayment, setDetailsPayment] = useState<PaymentItem | null>(null);
  
  const [formData, setFormData] = useState({
    id: 0,
    order_id: '',
    amount: '',
    payment_method: 'cash',
    reference_number: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/payments');
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      setError('Unable to load payment information. Please check the backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchOrders();
  }, []);

  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData({ id: 0, order_id: '', amount: '', payment_method: 'cash', reference_number: '' });
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };

  const openEditModal = (payment: PaymentItem) => {
    setIsEditMode(true);
    const amountVal = payment.amount ? String(payment.amount) : String(payment.final_amount || payment.total_amount || '');
    setFormData({
      id: payment.payment_id || payment.id,
      order_id: payment.order_id.toString(),
      amount: amountVal,
      payment_method: payment.payment_method?.toLowerCase().includes('gcash') ? 'gcash' : 'cash',
      reference_number: payment.reference_number || ''
    });
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      if (!formData.order_id) {
        setError('Order is required');
        return;
      }
      const amt = parseFloat(formData.amount);
      if (isNaN(amt) || amt < 0) {
        setError('Valid positive amount is required');
        return;
      }

      if (isEditMode && formData.id > 0) {
        await api.put(`/payments/${formData.id}`, {
          amount: amt,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number
        });
        setSuccess('Payment updated successfully.');
      } else {
        await api.post('/payments', {
          order_id: parseInt(formData.order_id),
          amount: amt,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number
        });
        setSuccess('Payment successfully recorded.');
      }
      
      fetchPayments();
      setTimeout(() => setIsModalOpen(false), 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving payment');
    }
  };

  // Status and Search Filtering
  const filteredPayments = payments.filter((p) => {
    const sTerm = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      !sTerm ||
      p.order_number?.toLowerCase().includes(sTerm) ||
      p.customer_name?.toLowerCase().includes(sTerm) ||
      p.reference_number?.toLowerCase().includes(sTerm) ||
      p.service_name?.toLowerCase().includes(sTerm);

    const normStatus = (p.payment_status || 'unpaid').toLowerCase();

    let matchesStatus = true;
    if (statusFilter === 'unpaid') {
      matchesStatus = normStatus === 'unpaid';
    } else if (statusFilter === 'pending') {
      matchesStatus = normStatus.includes('pending') || normStatus === 'partially paid';
    } else if (statusFilter === 'paid') {
      matchesStatus = normStatus === 'paid' || normStatus.includes('demo');
    } else if (statusFilter === 'failed') {
      matchesStatus = normStatus === 'failed';
    } else if (statusFilter === 'refunded') {
      matchesStatus = normStatus === 'refunded';
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate Accurate Summary Totals from database records
  // 1. Total approved requests requiring payment tracking
  const totalApprovedRequestsCount = payments.length;
  const filteredRequestsCount = filteredPayments.length;

  // 2. Unpaid amount: sum of payable amounts for requests with Unpaid status
  const unpaidAmountTotal = payments
    .filter((p) => (p.payment_status || '').toLowerCase() === 'unpaid')
    .reduce((sum, p) => {
      const payable = parseFloat(String(p.final_amount ?? p.total_amount ?? p.estimated_amount ?? 0));
      return sum + (isNaN(payable) ? 0 : payable);
    }, 0);

  // 3. Pending payments: count and amount
  const pendingPaymentsList = payments.filter((p) => (p.payment_status || '').toLowerCase().includes('pending'));
  const pendingPaymentsCount = pendingPaymentsList.length;
  const pendingPaymentsAmount = pendingPaymentsList.reduce((sum, p) => {
    const amt = parseFloat(String(p.final_amount ?? p.total_amount ?? p.estimated_amount ?? 0));
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  // 4. Confirmed paid amount: sum of verified paid revenue (strictly excluding unpaid estimates)
  const confirmedPaidAmount = payments
    .filter((p) => {
      const st = (p.payment_status || '').toLowerCase();
      return st === 'paid' || st === 'paid (demo)';
    })
    .reduce((sum, p) => {
      const paid = parseFloat(String(p.amount ?? p.final_amount ?? p.total_amount ?? 0));
      return sum + (isNaN(paid) ? 0 : paid);
    }, 0);

  const selectedOrder = formData.order_id ? orders.find((o) => o.id.toString() === formData.order_id) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <DollarSign className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Payment Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track all approved laundry requests, verify customer settlements, and monitor revenue in Poblacion, Lagonglong
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPayments()}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 transition-colors"
            title="Refresh Payments"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button 
            onClick={openCreateModal} 
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Approved Requests */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Approved Requests</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              {totalApprovedRequestsCount}
            </span>
            <span className="text-xs text-gray-500 block mt-0.5">
              Orders requiring payment tracking
            </span>
          </div>
        </div>

        {/* Unpaid Amount */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Unpaid Amount</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-red-600 dark:text-red-400">
              ₱{unpaidAmountTotal.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500 block mt-0.5">
              Outstanding receivable balance
            </span>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Payments</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {pendingPaymentsCount} <span className="text-base font-semibold text-gray-500">Orders</span>
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block mt-0.5">
              ₱{pendingPaymentsAmount.toFixed(2)} awaiting verification
            </span>
          </div>
        </div>

        {/* Confirmed Paid Amount */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Confirmed Paid</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              ₱{confirmedPaidAmount.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500 block mt-0.5">
              Verified received revenue
            </span>
          </div>
        </div>

      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Order #, Customer, or Reference #..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Dropdown Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-bold text-gray-500 shrink-0">Filter Status:</label>
          <select
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {FILTER_STATUSES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {error && !isModalOpen && (
        <div className="p-4 text-red-700 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Order Ref #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Laundry Service</th>
                <th className="py-3.5 px-4">Estimated Amount</th>
                <th className="py-3.5 px-4">Final Confirmed</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Payment Status</th>
                <th className="py-3.5 px-4">Order Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading payment records...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-400">
                    <DollarSign className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                    No approved laundry requests matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const estAmount = parseFloat(String(p.estimated_amount ?? p.total_amount ?? 0));
                  const finAmount = p.final_amount !== null && p.final_amount !== undefined ? parseFloat(String(p.final_amount)) : null;
                  const isPaid = (p.payment_status || '').toLowerCase() === 'paid' || (p.payment_status || '').toLowerCase().includes('demo');

                  return (
                    <tr key={`${p.order_id}-${p.payment_id || 0}`} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                      
                      {/* Order Ref Number */}
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-blue-600 dark:text-blue-400 block font-mono">
                          {p.order_number}
                        </span>
                        {p.reference_number && (
                          <span className="text-[10px] text-gray-400 font-mono block truncate max-w-[130px]" title={p.reference_number}>
                            Ref: {p.reference_number}
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-gray-900 dark:text-white block">
                          {p.customer_name}
                        </span>
                        {p.customer_phone && (
                          <span className="text-[11px] text-gray-500 font-mono block">
                            {p.customer_phone}
                          </span>
                        )}
                      </td>

                      {/* Laundry Service */}
                      <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300">
                        {p.service_name || 'Wash & Fold'}
                      </td>

                      {/* Estimated Amount */}
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                        ₱{estAmount.toFixed(2)}
                      </td>

                      {/* Final Confirmed Amount */}
                      <td className="py-3.5 px-4">
                        {finAmount !== null ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ₱{finAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">
                            Awaiting Weighing
                          </span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 capitalize text-gray-700 dark:text-gray-300 font-medium">
                        {p.payment_method?.replace(/_/g, ' ') || 'COD'}
                      </td>

                      {/* Payment Status (Semantic Badge) */}
                      <td className="py-3.5 px-4">
                        <StatusBadge 
                          status={p.payment_status} 
                          type="payment" 
                          isDemo={p.is_demo} 
                        />
                        {p.payment_date && (
                          <span className="block text-[10px] text-gray-400 mt-0.5">
                            {new Date(p.payment_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </td>

                      {/* Related Order Status (Semantic Badge) */}
                      <td className="py-3.5 px-4">
                        <StatusBadge 
                          status={p.order_status || 'Approved'} 
                          type="order" 
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailsPayment(p)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="View Payment & Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {isPaid ? (
                            <button
                              onClick={() => setSelectedReceiptPayment(p)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                              title="Print / View Official Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openEditModal(p)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-xs"
                              title="Record / Collect Payment"
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile / Tablet Cards View */}
        <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-400">Loading payment records...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No payment records found.</div>
          ) : (
            filteredPayments.map((p) => {
              const estAmount = parseFloat(String(p.estimated_amount ?? p.total_amount ?? 0));
              const finAmount = p.final_amount !== null && p.final_amount !== undefined ? parseFloat(String(p.final_amount)) : null;
              const isPaid = (p.payment_status || '').toLowerCase() === 'paid' || (p.payment_status || '').toLowerCase().includes('demo');

              return (
                <div key={`${p.order_id}-${p.payment_id || 0}`} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400 font-mono">
                        {p.order_number}
                      </span>
                      <span className="font-bold text-xs text-gray-900 dark:text-white block mt-0.5">
                        {p.customer_name}
                      </span>
                    </div>
                    <StatusBadge status={p.payment_status} type="payment" isDemo={p.is_demo} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Service</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{p.service_name || 'Wash & Fold'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Order Status</span>
                      <StatusBadge status={p.order_status || 'Approved'} type="order" className="text-[10px] py-0.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Estimated Price</span>
                      <span className="font-semibold text-gray-600 dark:text-gray-300">₱{estAmount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Final Confirmed</span>
                      {finAmount !== null ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₱{finAmount.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Weighing pending</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-gray-500 capitalize">
                      Method: <strong>{p.payment_method?.replace(/_/g, ' ') || 'COD'}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailsPayment(p)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        Details
                      </button>
                      {isPaid ? (
                        <button
                          onClick={() => setSelectedReceiptPayment(p)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Receipt
                        </button>
                      ) : (
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Record / Edit Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                {isEditMode ? 'Update Settlement' : 'Record Order Payment'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4">
              {error && <div className="p-3 text-red-700 bg-red-100 dark:bg-red-950/40 dark:text-red-400 rounded-xl text-xs font-semibold">{error}</div>}
              {success && <div className="p-3 text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl text-xs font-semibold">{success}</div>}
              
              <form id="paymentForm" onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">Approved Order</label>
                  <select
                    required
                    disabled={isEditMode}
                    value={formData.order_id}
                    onChange={(e) => setFormData({...formData, order_id: e.target.value})}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                  >
                    <option value="">-- Select Approved Order --</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>{o.order_number} — ₱{o.total_amount}</option>
                    ))}
                  </select>
                </div>

                {selectedOrder && (
                  <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-1">
                    <div className="flex justify-between"><span>Payable Amount:</span> <strong>₱{selectedOrder.total_amount || 0}</strong></div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">Amount (₱)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold focus:ring-2 focus:ring-emerald-500" 
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">Payment Method</label>
                  <select
                    required
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium uppercase"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">Reference / Notes</label>
                  <input 
                    type="text" 
                    value={formData.reference_number}
                    onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                    placeholder="e.g. COD-COLLECT-123 or GCASH Ref #"
                  />
                </div>
              </form>
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 mt-auto">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="paymentForm" 
                className="px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {detailsPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white flex items-center gap-2 font-mono">
                  {detailsPayment.order_number}
                </h3>
                <span className="text-xs text-gray-500">Order & Payment Tracking Breakdown</span>
              </div>
              <button onClick={() => setDetailsPayment(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Customer:</span>
                  <strong className="text-gray-900 dark:text-white">{detailsPayment.customer_name}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Phone:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{detailsPayment.customer_phone || 'None'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Laundry Service:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{detailsPayment.service_name || 'Wash & Fold'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Order Workflow Status:</span>
                  <StatusBadge status={detailsPayment.order_status || 'Approved'} type="order" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Payment Status:</span>
                  <StatusBadge status={detailsPayment.payment_status} type="payment" isDemo={detailsPayment.is_demo} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Payment Method:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200 uppercase">{detailsPayment.payment_method?.replace(/_/g, ' ') || 'COD'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Estimated Price:</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">₱{parseFloat(String(detailsPayment.estimated_amount ?? detailsPayment.total_amount ?? 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300 font-bold">Final Confirmed Amount:</span>
                  {detailsPayment.final_amount !== null && detailsPayment.final_amount !== undefined ? (
                    <strong className="text-emerald-600 dark:text-emerald-400 text-base">₱{parseFloat(String(detailsPayment.final_amount)).toFixed(2)}</strong>
                  ) : (
                    <span className="text-gray-400 italic">Pending shop weighing</span>
                  )}
                </div>
                {detailsPayment.reference_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300">Reference:</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">{detailsPayment.reference_number}</span>
                  </div>
                )}
                {detailsPayment.collector_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300">Collected By:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{detailsPayment.collector_name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 bg-gray-50 dark:bg-gray-900/50">
              <button 
                onClick={() => setDetailsPayment(null)} 
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReceiptPayment && (
        <ReceiptModal
          isOpen={!!selectedReceiptPayment}
          onClose={() => setSelectedReceiptPayment(null)}
          payment={{
            ...selectedReceiptPayment,
            amount: parseFloat(String(selectedReceiptPayment.amount || selectedReceiptPayment.final_amount || selectedReceiptPayment.total_amount || 0)),
            total_amount: parseFloat(String(selectedReceiptPayment.final_amount || selectedReceiptPayment.total_amount || 0))
          }}
        />
      )}

    </div>
  );
}
