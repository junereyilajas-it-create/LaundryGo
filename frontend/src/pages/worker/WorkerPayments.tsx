import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { DollarSign, Search, Edit, Eye, Plus, X, Printer, Calendar, User, FileText } from 'lucide-react';
import ReceiptModal from '../../components/common/ReceiptModal';

interface Order {
  id: number;
  order_number: string;
  total_amount: number;
}

interface Payment {
  id: number;
  order_id: number;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  reference_number: string;
  created_at: string;
  total_amount: number;
}

const PAYMENT_METHODS = ['cash', 'gcash', 'bank_transfer'];
const STATUS_OPTIONS = ['unpaid', 'partially_paid', 'paid', 'cancelled'];

export default function WorkerPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);
  
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
      setPayments(data);
    } catch (err: any) {
      console.error(err);
      setError('Unable to load payment information. Please check the server connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
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

  const openEditModal = (payment: Payment) => {
    setIsEditMode(true);
    setFormData({
      id: payment.id,
      order_id: payment.order_id.toString(),
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
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
        setError('Order ID is required');
        return;
      }
      const amt = parseFloat(formData.amount);
      if (isNaN(amt) || amt < 0) {
        setError('Valid positive amount is required');
        return;
      }

      if (isEditMode) {
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
      setTimeout(() => setIsModalOpen(false), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving payment');
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedOrder = formData.order_id ? orders.find(o => o.id.toString() === formData.order_id) : null;
  const existingPaymentsForOrder = formData.order_id ? payments.filter(p => p.order_id.toString() === formData.order_id && p.id !== formData.id) : [];
  const totalPaid = existingPaymentsForOrder.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  const remainingBalance = selectedOrder ? (parseFloat(selectedOrder.total_amount?.toString() || '0') - totalPaid) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            Payment Management
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage all LaundryGo payments</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="h-4 w-4" />
          Record Payment
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Order #, Customer, or Ref #..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(status => (
            <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
          ))}
        </select>
      </div>

      {error && !isModalOpen && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400">
                <th className="p-4">Payment ID</th>
                <th className="p-4">Order #</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Date</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Method</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">Loading payments...</td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">No payment records found.</td>
                </tr>
              ) : (
                filteredPayments.map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">PAY-{payment.id}</td>
                    <td className="p-4 text-blue-600 dark:text-blue-400">{payment.order_number}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">{payment.customer_name}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">{new Date(payment.created_at).toLocaleDateString()}</td>
                    <td className="p-4 font-semibold text-gray-900 dark:text-gray-100">₱{parseFloat(payment.amount.toString()).toFixed(2)}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300 capitalize">{payment.payment_method.replace('_', ' ')}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        payment.payment_status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        payment.payment_status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {payment.payment_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 flex items-center gap-2">
                      <button 
                        onClick={() => openEditModal(payment)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        title="Edit Payment"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setSelectedReceiptPayment(payment)}
                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        title="View & Print Official Receipt"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card-Based Layout */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-400">Loading payments...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No payment records found.</div>
          ) : (
            filteredPayments.map(payment => (
              <div key={payment.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-gray-900 dark:text-white block">
                      PAY-{payment.id}
                    </span>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {payment.order_number}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    payment.payment_status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    payment.payment_status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {payment.payment_status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Customer</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">
                      {payment.customer_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Amount Paid</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                      ₱{parseFloat(payment.amount.toString()).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Method</span>
                    <span className="capitalize text-gray-700 dark:text-gray-300">
                      {payment.payment_method.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Date</span>
                    <span className="text-gray-500">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => openEditModal(payment)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setSelectedReceiptPayment(payment)}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Receipt</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{isEditMode ? 'Edit Payment' : 'Record New Payment'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              {error && <div className="p-3 mb-4 text-red-700 bg-red-100 rounded-lg text-sm">{error}</div>}
              {success && <div className="p-3 mb-4 text-green-700 bg-green-100 rounded-lg text-sm">{success}</div>}
              
              <form id="paymentForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Order</label>
                  <select
                    required
                    disabled={isEditMode}
                    value={formData.order_id}
                    onChange={(e) => setFormData({...formData, order_id: e.target.value})}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-- Select Order --</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>{o.order_number} - ₱{o.total_amount}</option>
                    ))}
                  </select>
                </div>

                {selectedOrder && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <p className="flex justify-between"><span>Order Total:</span> <strong>₱{selectedOrder.total_amount || 0}</strong></p>
                    <p className="flex justify-between"><span>Amount Paid:</span> <strong>₱{totalPaid}</strong></p>
                    <p className="flex justify-between text-blue-600 dark:text-blue-400"><span>Remaining Balance:</span> <strong>₱{remainingBalance}</strong></p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Amount (₱)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                  <select
                    required
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                {(formData.payment_method === 'gcash' || formData.payment_method === 'bank_transfer') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reference Number</label>
                    <input 
                      type="text" 
                      required
                      value={formData.reference_number}
                      onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" 
                      placeholder="Enter transaction reference"
                    />
                  </div>
                )}
              </form>
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 mt-auto">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
              <button type="submit" form="paymentForm" className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Save Payment</button>
            </div>
          </div>
        </div>
      )}

      {selectedReceiptPayment && (
        <ReceiptModal
          isOpen={!!selectedReceiptPayment}
          onClose={() => setSelectedReceiptPayment(null)}
          payment={selectedReceiptPayment}
        />
      )}
    </div>
  );
}
