import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  CreditCard, 
  Search, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Smartphone, 
  Banknote, 
  X, 
  ArrowRight, 
  Receipt, 
  Info,
  Scale
} from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';

interface Order {
  id: number;
  order_number: string;
  service_name: string;
  estimated_weight: number;
  actual_weight: number | null;
  total_amount: number | string;
  estimated_amount: number | string | null;
  final_amount: number | string | null;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  pickup_address_text?: string;
}

interface PaymentRecord {
  id: number;
  order_id: number;
  order_number: string;
  amount: string | number;
  payment_method: string;
  payment_status: string;
  reference_number?: string;
  collector_name?: string;
  created_at: string;
}

export default function CustomerPayments() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payables' | 'history'>('payables');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'gcash' | 'cod'>('gcash');
  const [phone, setPhone] = useState('09171234567');
  const [pin, setPin] = useState('');
  const [pinSent, setPinSent] = useState(false);
  const [pinTimer, setPinTimer] = useState(0);
  const [demoPinNotice, setDemoPinNotice] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, paymentsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/payments')
      ]);
      setOrders(ordersRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (error) {
      console.error('Error fetching payments or orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Timer countdown for GCash PIN
  useEffect(() => {
    let interval: any;
    if (pinTimer > 0) {
      interval = setInterval(() => setPinTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [pinTimer]);

  const handleOpenPaymentModal = (order: Order) => {
    setSelectedOrder(order);
    setSelectedMethod(order.payment_method?.toLowerCase().includes('cod') ? 'cod' : 'gcash');
    setPin('');
    setPinSent(false);
    setPinTimer(0);
    setDemoPinNotice(null);
    setPaymentError(null);
    setPaymentSuccess(null);
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
    setProcessing(false);
    setPaymentError(null);
    setPaymentSuccess(null);
  };

  const handleSendDemoPin = async () => {
    if (!phone || phone.length < 10) {
      setPaymentError('Please enter a valid Philippine mobile number (e.g. 09171234567).');
      return;
    }
    setPaymentError(null);
    setProcessing(true);
    try {
      const res = await api.post('/payments/gcash/demo/generate-pin', { phone });
      setPinSent(true);
      setPinTimer(300); // 5 minutes
      if (res.data?.demo_pin) {
        setDemoPinNotice(`Demo PIN Code: ${res.data.demo_pin} (Valid for 5 mins)`);
        setPin(res.data.demo_pin);
      }
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to request GCash demo PIN.');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifyGcashPayment = async () => {
    if (!selectedOrder) return;
    if (!pin || pin.length !== 6) {
      setPaymentError('Please enter the 6-digit demo verification PIN.');
      return;
    }
    setPaymentError(null);
    setProcessing(true);
    try {
      const res = await api.post('/payments/gcash/demo/verify-and-pay', {
        order_id: selectedOrder.id,
        phone,
        pin
      });
      setPaymentSuccess(`Demo GCash payment confirmed! Ref: ${res.data.reference_number}`);
      setTimeout(() => {
        handleCloseModal();
        fetchData();
      }, 1500);
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'GCash demo verification failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectCod = async () => {
    if (!selectedOrder) return;
    setPaymentError(null);
    setProcessing(true);
    try {
      await api.post('/payments/cod/select', {
        order_id: selectedOrder.id
      });
      setPaymentSuccess('Cash on Delivery confirmed! Payment will be collected upon delivery.');
      setTimeout(() => {
        handleCloseModal();
        fetchData();
      }, 1500);
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to select Cash on Delivery.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredOrders = orders.filter(o => 
    o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.payment_status && o.payment_status.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredPayments = payments.filter(p => 
    p.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.payment_status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.reference_number && p.reference_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isOrderPaid = (status: string) => {
    const s = (status || '').toLowerCase();
    return s === 'paid' || s === 'paid (demo)';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Billing & Payments
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Review order payables, settle confirmed bills, and track transaction records
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-sm font-medium">
          <button
            onClick={() => setActiveTab('payables')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'payables'
                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Orders & Payables ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Transaction History ({payments.length})
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={activeTab === 'payables' ? "Search by Order #, status, or payment status..." : "Search by Order #, reference, or status..."}
          className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <Clock className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="font-medium text-sm">Loading billing records...</p>
        </div>
      ) : activeTab === 'payables' ? (
        /* Orders & Payables List */
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <Receipt className="h-10 w-10 text-gray-400 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-gray-800 dark:text-gray-200">No laundry orders found</p>
              <p className="text-xs text-gray-500 mt-1">When you request a service, it will appear here for billing and payment.</p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const paid = isOrderPaid(order.payment_status);
              const isConfirmed = order.final_amount !== null && order.final_amount !== undefined;
              const displayAmount = isConfirmed 
                ? parseFloat(order.final_amount as string).toFixed(2)
                : parseFloat(order.estimated_amount as string || order.total_amount as string).toFixed(2);

              return (
                <div 
                  key={order.id}
                  onClick={() => handleOpenPaymentModal(order)}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer flex flex-col sm:flex-row gap-5 justify-between sm:items-center group"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-lg text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {order.order_number}
                      </span>
                      
                      {/* Order Status Badge */}
                      <StatusBadge status={order.status} type="order" />

                      {/* Payment Status Badge */}
                      <StatusBadge status={order.payment_status} type="payment" />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <span>Service: <strong className="text-gray-700 dark:text-gray-300">{order.service_name}</strong></span>
                      <span>
                        Weight: {order.actual_weight ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{order.actual_weight} kg (Weighed)</span>
                        ) : (
                          <span>~{order.estimated_weight || 0} kg (Est.)</span>
                        )}
                      </span>
                      <span>Method: <strong className="uppercase text-gray-700 dark:text-gray-300">{order.payment_method || 'Pending'}</strong></span>
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100 dark:border-gray-800">
                    <div className="text-left sm:text-right">
                      <div className="flex items-baseline sm:justify-end gap-1.5">
                        <span className="text-2xl font-black text-gray-900 dark:text-gray-100">
                          ₱{displayAmount}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-gray-500">
                        {isConfirmed ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center sm:justify-end gap-1">
                            <CheckCircle className="h-3 w-3" /> Confirmed Final Bill
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center sm:justify-end gap-1">
                            <Clock className="h-3 w-3" /> Estimated Payable
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPaymentModal(order);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                        paid 
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200' 
                          : isConfirmed 
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {paid ? (
                        <>
                          <Receipt className="h-3.5 w-3.5" /> View Receipt
                        </>
                      ) : isConfirmed ? (
                        <>
                          <CreditCard className="h-3.5 w-3.5" /> Pay Now <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          <Scale className="h-3.5 w-3.5" /> View Bill Info
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Transaction History Records */
        <div className="space-y-4">
          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <Receipt className="h-10 w-10 text-gray-400 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-gray-800 dark:text-gray-200">No payment transactions yet</p>
              <p className="text-xs text-gray-500 mt-1">Confirmed GCash and COD payments will be recorded here.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-gray-500 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Reference Number</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Collector / Gateway</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                    {filteredPayments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-gray-100">{p.order_number}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">{p.reference_number || 'N/A'}</td>
                        <td className="py-3.5 px-4 uppercase font-semibold text-blue-600 dark:text-blue-400">{p.payment_method}</td>
                        <td className="py-3.5 px-4 font-bold text-sm text-gray-900 dark:text-gray-100">₱{parseFloat(p.amount as string).toFixed(2)}</td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={p.payment_status} type="payment" />
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">{p.collector_name || 'System (GCash)'}</td>
                        <td className="py-3.5 px-4 text-gray-500">{new Date(p.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAYMENT DETAILS & CHECKOUT MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-gray-900 dark:text-gray-100">
                  Payment Details — {selectedOrder.order_number}
                </h3>
              </div>
              <button 
                onClick={handleCloseModal}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              
              {/* Order Summary Card */}
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Service Category</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{selectedOrder.service_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Laundry Weight</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {selectedOrder.actual_weight !== null ? (
                      <span className="text-emerald-600 font-semibold">{selectedOrder.actual_weight} kg (Confirmed)</span>
                    ) : (
                      <span>~{selectedOrder.estimated_weight || 0} kg (Preliminary Estimate)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-blue-200/60 dark:border-blue-800/60 pt-2">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">
                      {selectedOrder.final_amount !== null ? 'Confirmed Final Payable' : 'Estimated Payable'}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {selectedOrder.final_amount !== null ? 'Calculated from actual weight' : 'Subject to actual weighing at facility'}
                    </span>
                  </div>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    ₱{parseFloat(selectedOrder.final_amount !== null ? String(selectedOrder.final_amount) : String(selectedOrder.estimated_amount || selectedOrder.total_amount)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Status & Messages */}
              {paymentError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{paymentError}</span>
                </div>
              )}

              {paymentSuccess && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{paymentSuccess}</span>
                </div>
              )}

              {/* Condition 1: Already Paid */}
              {isOrderPaid(selectedOrder.payment_status) ? (
                <div className="text-center py-4 space-y-3">
                  <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">Bill Already Paid</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Payment for this laundry request was settled via {selectedOrder.payment_method}.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs space-y-1 text-left">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment Status:</span>
                      <span className="font-semibold text-emerald-600">{selectedOrder.payment_status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Method:</span>
                      <span className="font-semibold uppercase">{selectedOrder.payment_method}</span>
                    </div>
                  </div>
                </div>
              ) : selectedOrder.final_amount === null ? (
                /* Condition 2: Not Yet Weighed */
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>Awaiting Actual Laundry Weighing</span>
                  </div>
                  <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
                    Per LaundriGo standard pricing rules, the initial amount of <strong>₱{parseFloat(String(selectedOrder.estimated_amount || selectedOrder.total_amount)).toFixed(2)}</strong> is an estimate. Our laundry staff will physically weigh your clothes upon arrival at the facility to generate your official final bill.
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 italic pt-1">
                    Payment will unlock as soon as the worker records the actual weight.
                  </p>
                </div>
              ) : (
                /* Condition 3: Weighed & Ready for Payment Selection */
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Choose Payment Method</p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Method 1: GCash Demo */}
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('gcash')}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        selectedMethod === 'gcash'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <Smartphone className="h-5 w-5 text-blue-600" />
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                          INSTANT DEMO
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-xs text-gray-900 dark:text-gray-100">GCash Demo</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Simulate payment via PIN verification</p>
                      </div>
                    </button>

                    {/* Method 2: COD */}
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('cod')}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        selectedMethod === 'cod'
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 ring-2 ring-emerald-500/20'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <Banknote className="h-5 w-5 text-emerald-600" />
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                          PAY ON DELIVERY
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-xs text-gray-900 dark:text-gray-100">Cash on Delivery</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Pay cash to driver upon delivery</p>
                      </div>
                    </button>
                  </div>

                  {/* Selected Method Details */}
                  {selectedMethod === 'gcash' ? (
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700 space-y-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        <span>Demo Simulation: No real money is transferred. Validates 6-digit PIN securely.</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          GCash Registered Mobile Number
                        </label>
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="09171234567"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-mono text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {!pinSent ? (
                        <button
                          type="button"
                          disabled={processing}
                          onClick={handleSendDemoPin}
                          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                          {processing ? 'Generating PIN...' : 'Send Demo Verification PIN'}
                        </button>
                      ) : (
                        <div className="space-y-2 pt-1">
                          {demoPinNotice && (
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-lg text-amber-800 dark:text-amber-300 text-xs font-semibold">
                              {demoPinNotice}
                            </div>
                          )}

                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                            Enter 6-Digit Verification PIN ({pinTimer}s remaining)
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-center font-mono text-lg tracking-widest text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          />

                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={pinTimer > 250 || processing}
                              onClick={handleSendDemoPin}
                              className="px-3 py-2 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            >
                              Resend PIN
                            </button>
                            <button
                              type="button"
                              disabled={processing || pin.length !== 6}
                              onClick={handleVerifyGcashPayment}
                              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                            >
                              {processing ? 'Verifying...' : `Verify & Pay ₱${parseFloat(String(selectedOrder.final_amount)).toFixed(2)}`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* COD Confirmation Box */
                    <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-3">
                      <div className="flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                        <Banknote className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Cash on Delivery Confirmation</p>
                          <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                            Our delivery driver will collect <strong>₱{parseFloat(String(selectedOrder.final_amount)).toFixed(2)}</strong> in physical cash when delivering your clean laundry.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={processing}
                        onClick={handleSelectCod}
                        className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {processing ? 'Confirming...' : 'Confirm Cash on Delivery'}
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end bg-gray-50/50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
