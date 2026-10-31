import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ShoppingBag, Sparkles, User, Phone, Mail, Scale, 
  CheckCircle2, AlertCircle, Loader2, Users, UserPlus, 
  Layers, Calendar, Clock, ShieldCheck, Check, Search,
  ArrowRight, DollarSign, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { calculateLaundryPricing, type PricingResult } from '../../lib/pricingCalculator';

interface CustomerOption {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  default_address?: string;
}

interface ServiceOption {
  id: number;
  name: string;
  description?: string;
  price: number;
}

interface AddCustomerLaundryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
  onError: (errorMessage: string) => void;
}

export default function AddCustomerLaundryModal({
  isOpen,
  onClose,
  onSuccess,
  onError
}: AddCustomerLaundryModalProps) {
  const { user } = useAuth();

  // Customer Mode: 'existing' or 'new'
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');

  // Existing Customers list
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [customerSearch, setCustomerSearch] = useState('');

  // New Customer inputs
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');

  // Laundry details
  const [weightInput, setWeightInput] = useState<string>('5.0');
  const [serviceName, setServiceName] = useState<string>('Wash & Fold');
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Payment status
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'bank_transfer'>('cash');

  // Submission state & feedback
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any>(null);

  // Live pricing calculation from established package rules
  const pricing: PricingResult = calculateLaundryPricing(weightInput);

  const fallbackServices: ServiceOption[] = [
    { id: 1, name: 'Wash & Fold', description: 'Standard everyday washing, tumble drying, and neat folding', price: 160 },
    { id: 2, name: 'Wash & Iron / Press', description: 'Washed, dried, and professionally steam ironed', price: 180 },
    { id: 3, name: 'Dry Cleaning', description: 'Delicate care for formal suits, barongs, and coats', price: 220 },
    { id: 4, name: 'Comforter & Heavy Blanket', description: 'Deep hygiene cleaning for heavy duvets and comforters', price: 180 }
  ];

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      fetchServices();
      setCustomerMode('existing');
      setSelectedCustomerId('');
      setCustomerSearch('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setWeightInput('5.0');
      setServiceName('Wash & Fold');
      setSpecialInstructions('');
      setPaymentStatus('unpaid');
      setPaymentMethod('cash');
      setValidationError(null);
      setCreatedResult(null);
    }
  }, [isOpen]);

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const { data } = await api.get('/users/customers').catch(() => api.get('/users?role=customer'));
      const custList = Array.isArray(data) ? data : [];
      setCustomers(custList);
      if (custList.length > 0) {
        setSelectedCustomerId(custList[0].id);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      const { data } = await api.get('/services');
      if (Array.isArray(data) && data.length > 0) {
        setServices(data);
      } else {
        setServices(fallbackServices);
      }
    } catch (err) {
      setServices(fallbackServices);
    } finally {
      setLoadingServices(false);
    }
  };

  if (!isOpen) return null;

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const selectedCustomerObj = customers.find((c) => c.id === Number(selectedCustomerId));

  const handleWeightPreset = (preset: string) => {
    setWeightInput(preset);
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate weight
    const numericWeight = parseFloat(weightInput);
    if (isNaN(numericWeight) || numericWeight <= 0) {
      setValidationError('Please enter a valid laundry weight greater than 0 kg. Negative or zero weight is not allowed.');
      return;
    }
    if (numericWeight > 100) {
      setValidationError('Laundry weight cannot exceed 100 kg in a single transaction.');
      return;
    }

    // Validate customer
    if (customerMode === 'existing') {
      if (!selectedCustomerId) {
        setValidationError('Please select an existing customer from the list or switch to "Register New Customer".');
        return;
      }
    } else {
      if (!newCustomerName.trim()) {
        setValidationError("Customer's name is required when registering a new customer.");
        return;
      }
      if (!newCustomerPhone.trim()) {
        setValidationError("Customer's contact number is required.");
        return;
      }
    }

    try {
      setSubmitting(true);

      const payload = {
        customer_id: customerMode === 'existing' ? selectedCustomerId : null,
        customer_name: customerMode === 'new' ? newCustomerName.trim() : (selectedCustomerObj?.name || ''),
        customer_phone: customerMode === 'new' ? newCustomerPhone.trim() : (selectedCustomerObj?.phone || ''),
        customer_email: customerMode === 'new' ? newCustomerEmail.trim() : (selectedCustomerObj?.email || ''),
        weight: numericWeight,
        service_name: serviceName,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        special_instructions: specialInstructions.trim()
      };

      const { data } = await api.post('/orders/walk-in', payload);

      setCreatedResult({
        order_number: data.order_number || data.order?.order_number,
        customer_name: payload.customer_name,
        service_name: serviceName,
        weight: numericWeight,
        total_amount: pricing.totalAmount,
        load_count: pricing.loadCount,
        loads: pricing.loads,
        payment_status: paymentStatus,
        raw: data
      });

      // Dispatch to parent components
      onSuccess(data);
    } catch (err: any) {
      console.error('Error adding walk-in laundry:', err);
      const msg = err.response?.data?.message || 'Failed to save walk-in laundry transaction. Your entries have been preserved. Please retry.';
      setValidationError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishSuccess = () => {
    onClose();
  };

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const currentTimeFormatted = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-auto flex flex-col max-h-[calc(100vh-40px)] sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================ */}
        {/* HEADER: Matches RequestServiceModal Design & Colors (Blue)   */}
        {/* ============================================================ */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 shadow-xs">
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight text-white flex items-center gap-1.5">
                Add Customer Laundry
              </h2>
              <p className="text-[11px] text-blue-100 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-200" /> Walk-in & Counter Drop-off • Poblacion Hub
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ============================================================ */}
        {/* MODAL BODY: Independently scrollable, preventing cut-offs   */}
        {/* ============================================================ */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
          
          {/* Validation Alert Callout */}
          {validationError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1 font-medium">{validationError}</div>
              <button 
                type="button" 
                onClick={() => setValidationError(null)} 
                className="text-red-400 hover:text-red-600 dark:hover:text-red-200 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Submitting Loading Overlay */}
          {submitting ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm border border-blue-100 dark:border-blue-800">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                  Recording Laundry Transaction...
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Calculating package loads, recording counter receipt, and starting processing.
                </p>
              </div>
            </div>
          ) : createdResult ? (
            /* ============================================================ */
            /* SUCCESS CONFIRMATION VIEW (Matching RequestServiceModal)      */
            /* ============================================================ */
            <div className="py-3 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20 border border-blue-200 dark:border-blue-800">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                  Walk-in Laundry Saved Successfully!
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-md mx-auto leading-relaxed">
                  Transaction has been registered and is automatically set to <strong>Processing</strong> ready for washing.
                </p>
              </div>

              {/* Order Reference and Load Breakdown Card */}
              <div className="max-w-md mx-auto p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-left space-y-2.5 text-xs shadow-xs">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 font-medium">Order Reference</span>
                  <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                    {createdResult.order_number}
                  </span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-bold text-gray-900 dark:text-white">{createdResult.customer_name}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-gray-500">Service</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{createdResult.service_name}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-gray-500">Measured Weight</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {createdResult.weight} kg ({createdResult.load_count} load{createdResult.load_count > 1 ? 's' : ''})
                  </span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-gray-500">Initial Status</span>
                  <span className="font-bold px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Processing (Washing)
                  </span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-gray-500">Payment Status</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                    createdResult.payment_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {createdResult.payment_status === 'paid' ? 'Paid (Collected)' : 'Unpaid (Pending)'}
                  </span>
                </div>

                {/* Multi-load distribution in success card */}
                {createdResult.loads && createdResult.loads.length > 0 && (
                  <div className="my-2 p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Package Breakdown:
                    </span>
                    <div className="space-y-1">
                      {createdResult.loads.map((load: any) => (
                        <div key={load.loadNumber} className="flex justify-between text-[11px] text-gray-600 dark:text-gray-300">
                          <span>Load #{load.loadNumber} ({load.price === 180 ? 'Up to 8 kg' : 'Up to 6 kg'}):</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">₱{load.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between py-1.5 border-t border-gray-200 dark:border-gray-700 items-baseline">
                  <span className="font-bold text-gray-700 dark:text-gray-300">Total Price</span>
                  <span className="font-black text-blue-600 dark:text-blue-400 text-lg">
                    ₱{Number(createdResult.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="max-w-md mx-auto pt-2">
                <button
                  type="button"
                  onClick={handleFinishSuccess}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Done & View Orders</span>
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* MAIN FORM: Organized, 2-column responsive layout             */
            /* ============================================================ */
            <form id="add-customer-laundry-form" onSubmit={handleSubmit} className="space-y-5">
              
              {/* SECTION 1: Customer Information */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    1. Customer Information
                  </label>
                  {customerMode === 'existing' && selectedCustomerObj && (
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      Selected: <strong>{selectedCustomerObj.name}</strong>
                    </span>
                  )}
                </div>

                {/* Segmented Mode Selector (Matches RequestServiceModal Tab style) */}
                <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setCustomerMode('existing'); setValidationError(null); }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      customerMode === 'existing'
                        ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Existing Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCustomerMode('new'); setValidationError(null); }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      customerMode === 'new'
                        ? 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Register New Customer</span>
                  </button>
                </div>

                {/* Mode A: Select Existing Customer */}
                {customerMode === 'existing' ? (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search customer by name, contact number, or email..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                      />
                    </div>
                    
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border border-gray-200 dark:border-gray-800 rounded-2xl p-1.5 bg-gray-50/70 dark:bg-gray-900/50 custom-scrollbar">
                      {loadingCustomers ? (
                        <div className="py-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Loading registered customers...</span>
                        </div>
                      ) : filteredCustomers.length === 0 ? (
                        <div className="py-6 text-center text-xs text-gray-500 space-y-1">
                          <p>No matching customers found for "{customerSearch}".</p>
                          <button
                            type="button"
                            onClick={() => { setCustomerMode('new'); setNewCustomerName(customerSearch); }}
                            className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                          >
                            + Register "{customerSearch}" as a new customer
                          </button>
                        </div>
                      ) : (
                        filteredCustomers.map((cust) => {
                          const isSelected = selectedCustomerId === cust.id;
                          return (
                            <div
                              key={cust.id}
                              onClick={() => { setSelectedCustomerId(cust.id); setValidationError(null); }}
                              className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs sm:text-sm ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-xs'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {cust.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="truncate">
                                  <span className="font-bold text-gray-900 dark:text-white mr-2">{cust.name}</span>
                                  <span className="text-[11px] text-gray-400">{cust.phone || 'No phone'}</span>
                                  {cust.email && <span className="text-[10px] text-gray-400 ml-1.5 hidden sm:inline">• {cust.email}</span>}
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  /* Mode B: Register New Customer (2 Columns) */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Customer Full Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Maria Santos"
                          value={newCustomerName}
                          onChange={(e) => { setNewCustomerName(e.target.value); setValidationError(null); }}
                          className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Contact / Mobile Number *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. 09171234567"
                          value={newCustomerPhone}
                          onChange={(e) => { setNewCustomerPhone(e.target.value); setValidationError(null); }}
                          className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Email Address <span className="text-gray-400 font-normal">(Optional, for digital receipt)</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <input
                          type="email"
                          placeholder="e.g. maria@example.com (optional)"
                          value={newCustomerEmail}
                          onChange={(e) => setNewCustomerEmail(e.target.value)}
                          className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Laundry Details & Weight */}
              <div className="space-y-3.5 border-t border-gray-100 dark:border-gray-800 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    2. Laundry Details & Package Weight
                  </label>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Up to 6kg = ₱160 • Up to 8kg = ₱180
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Service Selection */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Laundry Service Type
                    </label>
                    <select
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-semibold transition-colors"
                    >
                      {services.map((svc) => (
                        <option key={svc.id} value={svc.name}>
                          {svc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Weight in KG */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Measured Weight (kg) *
                      </label>
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        {pricing.loadCount} Load{pricing.loadCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="relative">
                      <Scale className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        required
                        placeholder="5.5"
                        value={weightInput}
                        onChange={(e) => {
                          setWeightInput(e.target.value);
                          setValidationError(null);
                        }}
                        className="w-full text-xs sm:text-sm pl-9 pr-12 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold transition-colors"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-bold text-gray-400">kg</span>
                    </div>
                  </div>
                </div>

                {/* Weight Preset Buttons (Matches RequestServiceModal) */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-1">
                    Quick Presets:
                  </span>
                  {['5.0', '8.0', '14.0', '16.0'].map((preset) => {
                    const isSelected = weightInput === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleWeightPreset(preset)}
                        className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750'
                        }`}
                      >
                        {preset} kg
                      </button>
                    );
                  })}
                </div>

                {/* Live Automatic Pricing Card (Matches RequestServiceModal) */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border border-blue-500/20 dark:border-blue-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Automatic Price Calculation
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {pricing.loadCount} load{pricing.loadCount > 1 ? 's' : ''} • {pricing.measuredWeight} kg
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-0.5">
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <p>Weight: <span className="font-bold text-gray-900 dark:text-white">{pricing.measuredWeight} kg</span></p>
                      <p>Service: <span className="font-semibold text-gray-800 dark:text-gray-200">{serviceName}</span></p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">Total Amount Due</span>
                      <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                        ₱{pricing.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Multi-load Distribution Table (Identical to RequestServiceModal) */}
                  {pricing.loads.length > 1 && (
                    <div className="pt-2 border-t border-blue-500/20 text-xs">
                      <div className="overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800/80 bg-white/70 dark:bg-gray-900/60 shadow-xs">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[10px] text-gray-500 uppercase bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                            <tr>
                              <th className="px-3 py-1.5 font-bold">Load #</th>
                              <th className="px-3 py-1.5 font-bold">Package Capacity</th>
                              <th className="px-3 py-1.5 text-right font-bold">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {pricing.loads.map((load) => (
                              <tr key={load.loadNumber}>
                                <td className="px-3 py-1.5 font-bold text-gray-900 dark:text-gray-100">
                                  Load {load.loadNumber}
                                </td>
                                <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300 text-[11px]">
                                  {load.price === 180 ? 'Up to 8 kg' : 'Up to 6 kg'} ({load.weight} kg)
                                </td>
                                <td className="px-3 py-1.5 text-right font-black text-blue-600 dark:text-blue-400">
                                  ₱{load.price.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: Payment Status & Counter Processing */}
              <div className="space-y-3.5 border-t border-gray-100 dark:border-gray-800 pt-4">
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  3. Payment Status & Processing
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Unpaid Card */}
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('unpaid')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      paymentStatus === 'unpaid'
                        ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-sm ring-2 ring-amber-400/40'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold">Unpaid</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900"></span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                      Customer will pay when picking up completed laundry.
                    </p>
                  </button>

                  {/* Paid Card */}
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      paymentStatus === 'paid'
                        ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 shadow-sm ring-2 ring-blue-500/40'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold">Paid (Collect Now)</span>
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                      Payment collected directly at shop counter now.
                    </p>
                  </button>
                </div>

                {/* If Paid is selected: Payment Method & Stamp Card */}
                {paymentStatus === 'paid' && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e: any) => setPaymentMethod(e.target.value)}
                          className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="cash">Cash (Counter)</option>
                          <option value="gcash">GCash (Counter Transfer)</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>

                      <div className="text-xs space-y-1 text-gray-600 dark:text-gray-300 pt-1 border-t sm:border-t-0 sm:border-l sm:pl-3 border-blue-200 dark:border-blue-800">
                        <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>Date: <strong className="text-gray-900 dark:text-white font-semibold">{currentDateFormatted}</strong></span>
                        </p>
                        <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>Time: <strong className="text-gray-900 dark:text-white font-semibold">{currentTimeFormatted}</strong></span>
                        </p>
                        <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Staff: <strong className="text-gray-900 dark:text-white font-semibold">{user?.name || 'Worker'}</strong></span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: Special Instructions / Notes */}
              <div className="space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-4">
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider block">
                  4. Garment Notes or Special Instructions <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Separate white clothes, delicate fabric, extra fabric softener requested..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
              </div>

            </form>
          )}

        </div>

        {/* ============================================================ */}
        {/* FIXED MODAL FOOTER: Anchored at bottom, never cut off        */}
        {/* ============================================================ */}
        {!createdResult && (
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {/* Quick Summary Pill in footer */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span>Total:</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                  ₱{pricing.totalAmount.toFixed(2)}
                </span>
                <span className="text-[11px] text-gray-400">({pricing.loadCount} load{pricing.loadCount > 1 ? 's' : ''})</span>
              </div>

              <button
                type="submit"
                form="add-customer-laundry-form"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Transaction...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Laundry Transaction</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
