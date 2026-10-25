import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, AlertCircle, Loader2, Sparkles, Truck, 
  MapPin, Calendar, Clock, DollarSign, ArrowRight, ArrowLeft, 
  Droplets, CheckCircle2, ShieldCheck, Smartphone, KeyRound,
  Compass, Info, Layers, Star
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MapComponent from '../map/MapComponent';
import { calculateLaundryPricing, type PricingResult } from '../../lib/pricingCalculator';

interface ServiceItem {
  id: number;
  name: string;
  description: string;
  price: number;
}

interface RequestServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: any) => void;
}

export default function RequestServiceModal({ isOpen, onClose, onOrderCreated }: RequestServiceModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Steps: 1: Details & Loads, 2: Schedule, 3: Pickup Location, 4: Payment & Review
  const [step, setStep] = useState<number>(1);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Step 1: Laundry Details & Weight
  const [selectedServiceId, setSelectedServiceId] = useState<number>(1);
  const [estimatedWeight, setEstimatedWeight] = useState('5.0');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Step 2: Schedule
  const [preferredDate, setPreferredDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [preferredTime, setPreferredTime] = useState('Afternoon (1:00 PM - 5:00 PM)');

  // Step 3: Pickup Location
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isUsingSavedProfileLocation, setIsUsingSavedProfileLocation] = useState(false);

  // Step 4: Payment
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'GCASH_DEMO'>('COD');
  const [gcashPhone, setGcashPhone] = useState('09123456789');
  const [generatedDemoPin, setGeneratedDemoPin] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinCountdown, setPinCountdown] = useState(300);
  const [isRequestingPin, setIsRequestingPin] = useState(false);
  const [pinRequested, setPinRequested] = useState(false);
  const [demoNotice, setDemoNotice] = useState(
    'GCash Demo Mode: Simulated payment for demonstration purposes. No real money is transferred.'
  );

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOrderResult, setCreatedOrderResult] = useState<any>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(2);

  const fallbackServices: ServiceItem[] = [
    { id: 1, name: 'Wash & Fold', description: 'Regular washing, tumble drying, and neat folding for everyday laundry.', price: 160.00 },
    { id: 2, name: 'Wash & Iron / Press', description: 'Washed, dried, and professionally steam ironed.', price: 180.00 },
    { id: 3, name: 'Dry Cleaning', description: 'Delicate care for formal suits, barongs, and coats.', price: 220.00 },
    { id: 6, name: 'Heavy Wash & Fold', description: 'Heavy blankets, comforters, and linen care.', price: 180.00 }
  ];

  // Dynamic pricing calculation from established business package rules
  const pricing: PricingResult = calculateLaundryPricing(estimatedWeight);

  useEffect(() => {
    if (isOpen) {
      fetchServices();
      setStep(1);
      setErrorMessage(null);
      setCreatedOrderResult(null);
      setGeneratedDemoPin(null);
      setEnteredPin('');
      setPinRequested(false);
      setRedirectCountdown(2);

      // Pre-fill location from confirmed user profile location
      if (user?.default_address && user?.latitude && user?.longitude) {
        setPickupAddress(user.default_address);
        setPickupCoords({ lat: Number(user.latitude), lng: Number(user.longitude) });
        setIsUsingSavedProfileLocation(true);
      } else {
        // No arbitrary default location! User must explicitly pin or provide one
        setPickupAddress('');
        setPickupCoords(null);
        setIsUsingSavedProfileLocation(false);
      }
    }
  }, [isOpen, user]);

  // Countdown timer for GCash demo PIN
  useEffect(() => {
    let timer: any;
    if (pinRequested && pinCountdown > 0) {
      timer = setInterval(() => setPinCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [pinRequested, pinCountdown]);

  // Auto-redirect to Customer Dashboard ~2.2 seconds after successful request
  useEffect(() => {
    let timer: any;
    let countTimer: any;
    if (createdOrderResult) {
      countTimer = setInterval(() => {
        setRedirectCountdown(prev => Math.max(0, prev - 1));
      }, 1000);

      timer = setTimeout(() => {
        onClose();
        navigate('/customer/dashboard', { state: { refresh: Date.now() } });
      }, 2300);
    }
    return () => {
      clearTimeout(timer);
      clearInterval(countTimer);
    };
  }, [createdOrderResult, navigate, onClose]);

  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      const { data } = await api.get('/services');
      if (Array.isArray(data) && data.length > 0) {
        setServices(data);
        setSelectedServiceId(data[0].id);
      } else {
        setServices(fallbackServices);
      }
    } catch (err) {
      setServices(fallbackServices);
    } finally {
      setLoadingServices(false);
    }
  };

  const currentService = services.find((s) => s.id === selectedServiceId) || services[0] || fallbackServices[0];

  // Validation functions
  const validateStep1 = (): boolean => {
    if (!selectedServiceId) {
      setErrorMessage('Please select a laundry service.');
      return false;
    }
    const w = parseFloat(estimatedWeight);
    if (isNaN(w) || w <= 0) {
      setErrorMessage('Please enter an estimated weight greater than 0 kg.');
      return false;
    }
    if (w > 100) {
      setErrorMessage('Estimated weight exceeds reasonable single-booking limits (100 kg).');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!preferredDate) {
      setErrorMessage('Please choose a preferred pickup date.');
      return false;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (preferredDate < todayStr) {
      setErrorMessage('Pickup date cannot be in the past.');
      return false;
    }
    if (!preferredTime) {
      setErrorMessage('Please select a preferred pickup time window.');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (!pickupCoords || isNaN(pickupCoords.lat) || isNaN(pickupCoords.lng)) {
      setErrorMessage('Please pin or select your pickup location on the map before proceeding.');
      return false;
    }
    if (!pickupAddress.trim()) {
      setErrorMessage('Please provide a readable street address or landmark in Poblacion, Lagonglong.');
      return false;
    }
    return true;
  };

  const handleStepClick = (targetStep: number) => {
    setErrorMessage(null);
    if (targetStep === step) return;
    if (targetStep < step) {
      setStep(targetStep);
      return;
    }
    if (targetStep >= 2 && !validateStep1()) return;
    if (targetStep >= 3 && !validateStep2()) return;
    if (targetStep >= 4 && !validateStep3()) return;
    setStep(targetStep);
  };

  const handleNext = () => {
    setErrorMessage(null);
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
    } else if (step === 3) {
      if (!validateStep3()) return;
      setStep(4);
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleRequestGcashDemoPin = async () => {
    setErrorMessage(null);
    const PH_PHONE_REGEX = /^(09|\+639)\d{9}$/;
    if (!PH_PHONE_REGEX.test(gcashPhone.trim())) {
      setErrorMessage('Please enter a valid Philippine mobile number (e.g. 09XXXXXXXXX).');
      return;
    }

    try {
      setIsRequestingPin(true);
      const res = await api.post('/payments/gcash/demo/generate-pin', {
        phone: gcashPhone.trim()
      });
      setGeneratedDemoPin(res.data.pin);
      setDemoNotice(res.data.notice);
      setPinCountdown(300);
      setPinRequested(true);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to generate demo PIN.');
    } finally {
      setIsRequestingPin(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (submitting) return; // Prevent double submission
    setErrorMessage(null);

    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    if (paymentMethod === 'GCASH_DEMO') {
      if (!enteredPin || enteredPin.trim().length !== 6) {
        setErrorMessage('Please enter the 6-digit demo verification PIN.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const orderPayload = {
        service_type: 'shop_pickup',
        service_name: currentService.name,
        estimated_weight: pricing.measuredWeight,
        load_count: pricing.loadCount,
        load_details: JSON.stringify(pricing.loads),
        total_amount: pricing.totalAmount,
        estimated_amount: pricing.totalAmount,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        pickup_address_text: pickupAddress.trim(),
        delivery_address_text: pickupAddress.trim(),
        pickup_latitude: pickupCoords!.lat,
        pickup_longitude: pickupCoords!.lng,
        delivery_latitude: pickupCoords!.lat,
        delivery_longitude: pickupCoords!.lng,
        special_instructions: specialInstructions.trim(),
        payment_method: paymentMethod
      };

      if (paymentMethod === 'COD') {
        const response = await api.post('/orders', orderPayload);
        const newOrder = {
          order_number: response.data.order_number,
          orderId: response.data.orderId,
          total_amount: pricing.totalAmount,
          load_count: pricing.loadCount,
          loads: pricing.loads,
          payment_method: 'COD',
          payment_status: 'Pending',
          status: response.data.status || 'Pending Approval'
        };

        setCreatedOrderResult(newOrder);
        if (onOrderCreated) onOrderCreated(response.data);
      } else {
        // GCash Demo Payment Flow
        const response = await api.post('/payments/gcash/demo/verify-and-pay', {
          phone: gcashPhone.trim(),
          pin: enteredPin.trim(),
          order_payload: orderPayload
        });

        const newOrder = {
          order_number: response.data.order_number,
          orderId: response.data.orderId,
          total_amount: pricing.totalAmount,
          load_count: pricing.loadCount,
          loads: pricing.loads,
          payment_method: 'GCASH_DEMO',
          payment_status: 'Paid (Demo)',
          reference_number: response.data.reference_number,
          status: response.data.status || 'Pending Approval'
        };

        setCreatedOrderResult(newOrder);
        if (onOrderCreated) onOrderCreated(response.data);
      }
    } catch (err: any) {
      console.error('Order creation error:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to submit laundry request. Your entries have been preserved. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-auto flex flex-col max-h-[94vh]"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">Request Laundry Service</h3>
              <p className="text-[11px] text-blue-100 flex items-center gap-1">
                <Truck className="w-3 h-3" /> Doorstep Pickup • Poblacion, Lagonglong
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Step Navigation Bar */}
        {!createdOrderResult && (
          <div className="px-3 sm:px-6 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs shrink-0 select-none">
            {[
              { num: 1, label: 'Details & Loads' },
              { num: 2, label: 'Schedule' },
              { num: 3, label: 'Location' },
              { num: 4, label: 'Review' }
            ].map((s, idx) => {
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              return (
                <React.Fragment key={s.num}>
                  <div
                    onClick={() => handleStepClick(s.num)}
                    className={`flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg transition-all ${
                      isActive 
                        ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/60 dark:bg-blue-900/30' 
                        : isCompleted 
                        ? 'text-gray-700 dark:text-gray-300 font-medium' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : isCompleted 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {isCompleted ? <Check className="w-3 h-3" /> : s.num}
                    </span>
                    <span className="hidden sm:inline text-xs">{s.label}</span>
                  </div>
                  {idx < 3 && <div className="h-[1px] w-3 bg-gray-300 dark:bg-gray-700 hidden sm:block" />}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar">
          
          {errorMessage && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SUBMITTING SPINNER */}
          {submitting ? (
            <div className="py-14 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                  Submitting Laundry Request...
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Saving order with confirmed pickup location and estimated load distribution.
                </p>
              </div>
            </div>
          ) : createdOrderResult ? (
            /* SUCCESS SCREEN (Requirement 7) */
            <div className="py-2 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                  Laundry Request Submitted Successfully!
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-md mx-auto leading-relaxed">
                  Your request has been received and is waiting for worker approval. You can track its progress in My Laundry.
                </p>
              </div>

              {/* Order Reference and Load Breakdown Card */}
              <div className="max-w-md mx-auto p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500">Order Reference</span>
                  <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                    {createdOrderResult.order_number}
                  </span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-gray-500">Service</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{currentService.name}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-gray-500">Estimated Weight</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {pricing.measuredWeight} kg ({pricing.loadCount} load{pricing.loadCount > 1 ? 's' : ''})
                  </span>
                </div>

                {/* Load Breakdown in Success card */}
                {pricing.loads && pricing.loads.length > 0 && (
                  <div className="my-2 p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                      Estimated Package Breakdown:
                    </span>
                    <div className="space-y-1">
                      {pricing.loads.map((load) => (
                        <div key={load.loadNumber} className="flex justify-between text-[11px] text-gray-600 dark:text-gray-300">
                          <span>Load {load.loadNumber} ({load.price === 180 ? 'Up to 8 kg' : 'Up to 6 kg'}):</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">₱{load.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between py-1 border-t border-gray-200 dark:border-gray-700 items-baseline">
                  <span className="font-bold text-gray-700 dark:text-gray-300">Total Estimated Price</span>
                  <span className="font-black text-blue-600 dark:text-blue-400 text-base">
                    ₱{createdOrderResult.total_amount.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-gray-500">Initial Status</span>
                  <span className="font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px]">
                    Pending Approval
                  </span>
                </div>
              </div>

              {/* Auto Redirect Countdown Message */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-center border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
                <span>Returning to Customer Dashboard in <strong>{redirectCountdown}s</strong>...</span>
              </div>

              <div className="max-w-md mx-auto flex gap-2">
                <Button
                  onClick={() => {
                    onClose();
                    navigate('/customer/dashboard', { state: { refresh: Date.now() } });
                  }}
                  className="w-1/2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold h-10"
                >
                  Return to Dashboard
                </Button>
                <Button
                  onClick={() => {
                    onClose();
                    navigate('/customer/orders');
                  }}
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-10 shadow-sm"
                >
                  View in My Laundry
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: LAUNDRY DETAILS & MULTI-LOAD CALCULATION (Requirement 6) */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      1. Select Laundry Service & Enter Weight
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Standard package capacities: Up to 6 kg (₱160) • Up to 8 kg (₱180).
                    </p>
                  </div>

                  {loadingServices ? (
                    <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {services.map((svc) => (
                        <div
                          key={svc.id}
                          onClick={() => setSelectedServiceId(svc.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedServiceId === svc.id
                              ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500 shadow-sm'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-850'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-xs text-gray-900 dark:text-white">{svc.name}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                              From ₱160
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{svc.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Estimated Weight Input */}
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="estWeight" className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Customer Estimated Weight (kg)
                      </Label>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                        {pricing.loadCount} Estimated Load{pricing.loadCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="estWeight"
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="100"
                          value={estimatedWeight}
                          onChange={(e) => setEstimatedWeight(e.target.value)}
                          className="h-9 text-xs pr-10 font-mono font-bold"
                          placeholder="e.g. 14.0"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">kg</span>
                      </div>
                      <div className="flex gap-1">
                        {['5.0', '8.0', '14.0', '16.0'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setEstimatedWeight(preset)}
                            className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                              estimatedWeight === preset 
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {preset} kg
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* MULTI-LOAD BREAKDOWN TABLE (Requirement 6A & 6B) */}
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xs">
                      <div className="bg-gray-100/70 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs font-bold text-gray-800 dark:text-gray-200">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          Automatic Load Calculation:
                        </span>
                        <span className="text-blue-600 dark:text-blue-400 font-black">
                          Total: {pricing.loadCount} load{pricing.loadCount > 1 ? 's' : ''}
                        </span>
                      </div>

                      <table className="w-full text-xs text-left">
                        <thead className="text-[11px] text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
                          <tr>
                            <th className="px-3 py-1.5 font-bold">Load</th>
                            <th className="px-3 py-1.5 font-bold">Package Capacity</th>
                            <th className="px-3 py-1.5 text-right font-bold">Estimated Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {pricing.loads.map((l) => (
                            <tr key={l.loadNumber} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                              <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100">
                                Load {l.loadNumber}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                                {l.price === 180 ? 'Up to 8 kg' : 'Up to 6 kg'} ({l.weight} kg)
                              </td>
                              <td className="px-3 py-2 text-right font-black text-gray-900 dark:text-gray-100">
                                ₱{l.price.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-blue-50/60 dark:bg-blue-950/40 border-t border-blue-100 dark:border-blue-900 font-bold text-xs">
                          <tr>
                            <td className="px-3 py-2 text-blue-900 dark:text-blue-200" colSpan={2}>
                              Estimated Total ({pricing.loadCount} load{pricing.loadCount > 1 ? 's' : ''} • {pricing.measuredWeight} kg)
                            </td>
                            <td className="px-3 py-2 text-right text-blue-700 dark:text-blue-300 font-black text-sm">
                              ₱{pricing.totalAmount.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                        <span>
                          Notice: This is an estimate based on your entered weight. Actual measured weight and final load pricing will be confirmed by worker after weighing.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Special Instructions */}
                  <div className="space-y-1">
                    <Label htmlFor="specialNotes" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Garment Notes / Special Instructions (Optional)
                    </Label>
                    <textarea
                      id="specialNotes"
                      rows={2}
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="e.g., Separate whites, delicate cycle for uniforms..."
                      className="w-full text-xs p-2.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: PICKUP SCHEDULE */}
              {step === 2 && (
                <div className="space-y-3.5">
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      2. Pickup Schedule
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Select date and preferred time window for doorstep collection in Poblacion, Lagonglong.
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="pickupDate" className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        Pickup Date
                      </Label>
                      <Input
                        id="pickupDate"
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Preferred Time Slot
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'Morning (8:00 AM - 12:00 PM)', label: 'Morning', desc: '8 AM - 12 PM' },
                          { id: 'Afternoon (1:00 PM - 5:00 PM)', label: 'Afternoon', desc: '1 PM - 5 PM' },
                          { id: 'Evening (5:00 PM - 8:00 PM)', label: 'Evening', desc: '5 PM - 8 PM' }
                        ].map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setPreferredTime(slot.id)}
                            className={`p-2 rounded-xl border text-left transition-all ${
                              preferredTime === slot.id
                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500 font-bold'
                                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:border-gray-300'
                            }`}
                          >
                            <span className="block text-xs">{slot.label}</span>
                            <span className="text-[10px] text-gray-400 block">{slot.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      Fulfillment Method: Doorstep Pickup
                    </span>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                      Our assigned driver will arrive at your confirmed location during this schedule window.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3: PICKUP LOCATION & PROFILE LOCATION INTEGRATION (Requirement 5C) */}
              {step === 3 && (
                <div className="space-y-3.5">
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center justify-between">
                      <span>3. Confirmed Pickup Location</span>
                      {pickupCoords && (
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                          {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      We require a confirmed GPS pin so drivers can navigate directly to your door.
                    </p>
                  </div>

                  {/* Profile Location Status Card */}
                  {isUsingSavedProfileLocation && pickupCoords ? (
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
                      <Star className="w-4 h-4 text-emerald-600 fill-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                          Pre-filled from your Saved Profile Location:
                        </span>
                        <p className="text-emerald-800 dark:text-emerald-300 font-medium mt-0.5">
                          {pickupAddress}
                        </p>
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          You may click anywhere on the map below if you wish to change the pickup spot for this order.
                        </p>
                      </div>
                    </div>
                  ) : !pickupCoords ? (
                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">No saved location in your profile</span>
                        <span>Please click anywhere on the map or tap "Use My Current Location" to drop a pin.</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Leaflet Interactive Map */}
                  <div className="space-y-2">
                    <MapComponent
                      initialPosition={pickupCoords ? [pickupCoords.lat, pickupCoords.lng] : null}
                      height="230px"
                      onLocationSelect={(lat, lng, address) => {
                        setPickupCoords({ lat, lng });
                        if (address) {
                          setPickupAddress(address);
                        }
                        setIsUsingSavedProfileLocation(false);
                      }}
                    />

                    {/* Street Address Input */}
                    <div className="space-y-1">
                      <Label htmlFor="addressText" className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Street Address / Landmark Details (Lagonglong)
                      </Label>
                      <Input
                        id="addressText"
                        type="text"
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        placeholder="House/Unit #, Street, Purok, Poblacion, Lagonglong..."
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & PAYMENT PREFERENCE */}
              {step === 4 && (
                <div className="space-y-3.5">
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      4. Review Order & Payment Preference
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Review package breakdown and choose your payment method.
                    </p>
                  </div>

                  {/* Summary Card with Multi-Load Breakdown */}
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-gray-500">Service</span>
                      <span className="font-bold text-gray-900 dark:text-white">{currentService.name}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Estimated Total Weight</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {pricing.measuredWeight} kg ({pricing.loadCount} load{pricing.loadCount > 1 ? 's' : ''})
                      </span>
                    </div>

                    {/* Load Breakdown in Review Step */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                      <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                        Package Breakdown:
                      </span>
                      <div className="space-y-1">
                        {pricing.loads.map((l) => (
                          <div key={l.loadNumber} className="flex justify-between text-[11px] text-gray-600 dark:text-gray-400">
                            <span>Load {l.loadNumber} ({l.price === 180 ? 'Up to 8 kg' : 'Up to 6 kg'}):</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100">₱{l.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Fulfillment</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">Doorstep Pickup</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Pickup Schedule</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{preferredDate} • {preferredTime}</span>
                    </div>

                    <div className="flex justify-between items-start gap-2">
                      <span className="text-gray-500 shrink-0">Pickup Location</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 text-right line-clamp-2">
                        {pickupAddress} {pickupCoords && `(${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)})`}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-baseline">
                      <div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white block">
                          Total Estimated Price
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Subject to worker weighing confirmation
                        </span>
                      </div>
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                        ₱{pricing.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Payment Method
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div
                        onClick={() => setPaymentMethod('COD')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'COD'
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-500 shadow-sm'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-850'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            Cash on Delivery (COD)
                          </span>
                          {paymentMethod === 'COD' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Pay cash upon receiving your clean, folded laundry.
                        </p>
                      </div>

                      <div
                        onClick={() => setPaymentMethod('GCASH_DEMO')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'GCASH_DEMO'
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-500 shadow-sm'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-850'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                            GCash (Demo)
                          </span>
                          {paymentMethod === 'GCASH_DEMO' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Instant simulated cashless payment demo.
                        </p>
                      </div>
                    </div>

                    {/* GCash Demo Panel */}
                    {paymentMethod === 'GCASH_DEMO' && (
                      <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="gcashPhone" className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                              GCash Mobile #
                            </Label>
                            <Input
                              id="gcashPhone"
                              type="tel"
                              value={gcashPhone}
                              onChange={(e) => setGcashPhone(e.target.value)}
                              placeholder="09XXXXXXXXX"
                              className="h-8 text-xs font-mono"
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              onClick={handleRequestGcashDemoPin}
                              disabled={isRequestingPin}
                              className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            >
                              {isRequestingPin ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <KeyRound className="w-3.5 h-3.5 mr-1" />}
                              {pinRequested ? 'Resend Demo PIN' : 'Request Demo PIN'}
                            </Button>
                          </div>
                        </div>

                        {generatedDemoPin && (
                          <div className="p-2.5 bg-white dark:bg-gray-900 rounded-lg border border-blue-300 dark:border-blue-700 space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-gray-500">Your Generated Demo PIN:</span>
                              <span className="font-bold text-amber-600">Expires in {pinCountdown}s</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-lg font-black tracking-widest text-blue-600 dark:text-blue-400">
                                {generatedDemoPin}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEnteredPin(generatedDemoPin)}
                                className="text-[11px] text-blue-600 hover:underline font-semibold"
                              >
                                Auto-Fill PIN
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label htmlFor="enteredPin" className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                            Enter 6-Digit Demo PIN
                          </Label>
                          <Input
                            id="enteredPin"
                            type="text"
                            maxLength={6}
                            value={enteredPin}
                            onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="6-digit PIN"
                            className="h-8 text-xs font-mono font-bold tracking-widest text-center"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer Controls */}
        {!createdOrderResult && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={submitting}
                className="gap-1.5 text-xs font-semibold h-9"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-gray-500 h-9"
              >
                Cancel
              </Button>
            )}

            <div className="flex items-center gap-2">
              {step < 4 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 text-xs h-9 px-4"
                >
                  Next Step
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmitOrder}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-1.5 text-xs h-9 px-5 shadow-md shadow-emerald-600/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting Request...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Confirm Request
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
