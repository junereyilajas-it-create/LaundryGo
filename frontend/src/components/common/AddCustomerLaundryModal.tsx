import React, { useState, useEffect } from 'react';
import { 
  X, UserPlus, Users, Scale, DollarSign, CheckCircle2, 
  AlertCircle, Loader2, Sparkles, Phone, User, Mail, CreditCard, 
  Calendar, Clock, ShieldCheck, ShoppingBag
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

  // Mode: 'existing' or 'new'
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
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Payment status
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'bank_transfer'>('cash');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Live pricing calculation from existing business package rules
  const pricing: PricingResult = calculateLaundryPricing(weightInput);

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
    }
  }, [isOpen]);

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const { data } = await api.get('/users/customers').catch(() => api.get('/users?role=customer'));
      setCustomers(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setSelectedCustomerId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data } = await api.get('/services');
      if (Array.isArray(data) && data.length > 0) {
        setServices(data);
      }
    } catch (err) {
      // fallback
    }
  };

  if (!isOpen) return null;

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch)) ||
    (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  const selectedCustomerObj = customers.find(c => c.id === Number(selectedCustomerId));

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
        setValidationError('Please select an existing customer from the list or register a new customer.');
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

      onClose();
      onSuccess(data);
    } catch (err: any) {
      console.error('Error adding walk-in laundry:', err);
      const msg = err.response?.data?.message || 'Failed to save walk-in laundry transaction. Please verify details and try again.';
      setValidationError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">
                Add Customer Laundry
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Register walk-in or drop-off laundry transaction at the laundry shop
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection Mode Toggle */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Customer Information
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-2xl">
              <button
                type="button"
                onClick={() => { setCustomerMode('existing'); setValidationError(null); }}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  customerMode === 'existing'
                    ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Existing Customer</span>
              </button>
              <button
                type="button"
                onClick={() => { setCustomerMode('new'); setValidationError(null); }}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  customerMode === 'new'
                    ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Register New Customer</span>
              </button>
            </div>

            {customerMode === 'existing' ? (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="Search existing customer by name, phone, or email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 border border-gray-100 dark:border-gray-800 rounded-2xl p-1.5 bg-gray-50/50 dark:bg-gray-900/50">
                  {loadingCustomers ? (
                    <div className="p-4 text-center text-xs text-gray-500">Loading customers...</div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No matching customers found. Try switching to "Register New Customer".
                    </div>
                  ) : (
                    filteredCustomers.map(cust => (
                      <div
                        key={cust.id}
                        onClick={() => setSelectedCustomerId(cust.id)}
                        className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs sm:text-sm ${
                          selectedCustomerId === cust.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                            {cust.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold">{cust.name}</span>
                            <span className="text-[11px] text-gray-400 ml-2">{cust.phone || 'No phone'}</span>
                          </div>
                        </div>
                        {selectedCustomerId === cust.id && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                    Customer Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                    Contact / Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 09171234567"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                    Email Address (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      placeholder="e.g. maria@example.com (optional)"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Laundry Weight & Service */}
          <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Laundry Details & Weight
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Laundry Weight in Kilograms (KG) *
                </label>
                <div className="relative">
                  <Scale className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    required
                    placeholder="Enter weight in KG (e.g. 5.5)"
                    value={weightInput}
                    onChange={(e) => {
                      setWeightInput(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Pricing rules: Up to 6 kg = ₱160 | 6.01 - 8 kg = ₱180 | Over 8 kg = Multi-load
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Laundry Service
                </label>
                <select
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                >
                  <option value="Wash & Fold">Wash & Fold (Standard)</option>
                  <option value="Wash & Iron / Press">Wash & Iron / Press</option>
                  <option value="Dry Cleaning">Dry Cleaning</option>
                  <option value="Comforter & Heavy Blanket">Comforter & Heavy Blanket</option>
                </select>
              </div>
            </div>

            {/* Live Pricing Breakdown Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-green-500/10 border border-emerald-500/20 dark:border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Automatic Price Calculation
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {pricing.loadCount} load(s) • {pricing.measuredWeight} kg
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                  <p>Weight: <span className="font-bold text-gray-900 dark:text-white">{pricing.measuredWeight} kg</span></p>
                  <p>Service: <span className="font-semibold text-gray-800 dark:text-gray-200">{serviceName}</span></p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 block font-medium">Total Amount Due</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    ₱{pricing.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {pricing.loads.length > 1 && (
                <div className="pt-2 border-t border-emerald-500/20 text-[11px] text-gray-600 dark:text-gray-300 space-y-1">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">Load Distribution:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {pricing.loads.map(load => (
                      <div key={load.loadNumber} className="bg-white/60 dark:bg-gray-800/60 p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex justify-between">
                        <span>Load #{load.loadNumber} ({load.weight} kg)</span>
                        <span className="font-bold">₱{load.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Status & Details */}
          <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Payment Status & Processing
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentStatus('unpaid')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  paymentStatus === 'unpaid'
                    ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-sm ring-2 ring-amber-400/30'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Unpaid</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Customer will pay upon pickup/completion
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatus('paid')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  paymentStatus === 'paid'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-sm ring-2 ring-emerald-500/30'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Paid (Collect Now)</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Payment collected directly at shop counter
                </p>
              </button>
            </div>

            {paymentStatus === 'paid' && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                    >
                      <option value="cash">Cash (Counter)</option>
                      <option value="gcash">GCash (Counter Transfer)</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>

                  <div className="text-xs space-y-1 text-gray-600 dark:text-gray-300 pt-1">
                    <p className="flex items-center gap-1.5 text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      Payment Date: <span className="font-semibold text-gray-900 dark:text-white">{currentDateFormatted}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      Payment Time: <span className="font-semibold text-gray-900 dark:text-white">{currentTimeFormatted}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-gray-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Collected by: <span className="font-semibold text-gray-900 dark:text-white">{user?.name || 'Worker'}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                Special Instructions or Garment Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Separate white clothes, delicate fabric, extra softener requested..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
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
        </form>
      </div>
    </div>
  );
}
