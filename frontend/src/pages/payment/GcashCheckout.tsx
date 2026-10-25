import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, 
  Smartphone, Loader2, Receipt, Download, ExternalLink, Printer 
} from 'lucide-react';
import api from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function GcashCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const refNumber = searchParams.get('ref') || `GCASH-${Date.now()}`;
  const orderId = searchParams.get('order_id');
  const initialAmount = searchParams.get('amount') || '0.00';

  // Checkout Stages: 'prompt_mobile' | 'prompt_otp' | 'processing' | 'success' | 'failed'
  const [stage, setStage] = useState<'prompt_mobile' | 'prompt_otp' | 'processing' | 'success' | 'failed'>('prompt_mobile');
  const [gcashMobile, setGcashMobile] = useState('0917 123 4567');
  const [otp, setOtp] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);

  const handleMobileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gcashMobile.trim() || gcashMobile.length < 10) {
      setErrorMessage('Please enter a valid 11-digit Philippine mobile number.');
      return;
    }
    setErrorMessage(null);
    setStage('prompt_otp');
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length < 4) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setErrorMessage(null);
    setStage('processing');

    try {
      // Call backend verification endpoint
      const response = await api.post('/payments/gcash/verify', {
        reference_number: refNumber,
        transaction_id: `MPIN-${Date.now()}`
      });

      setReceiptData({
        reference_number: refNumber,
        amount: parseFloat(initialAmount),
        date: new Date().toLocaleString(),
        payment_method: 'GCash',
        status: 'PAID'
      });

      setStage('success');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'GCash payment authorization failed. Please try again.');
      setStage('failed');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#005ce6] text-white flex flex-col justify-center items-center p-4">
      
      {/* LaundriGo Back Button */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center text-blue-100">
        <button
          onClick={() => navigate('/customer/orders')}
          className="inline-flex items-center gap-1.5 text-xs hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Cancel & Return to Orders
        </button>
        <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
          Philippine Payment Gateway
        </span>
      </div>

      <div className="w-full max-w-md bg-white text-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-blue-200">
        
        {/* GCash Header Brand */}
        <div className="bg-[#005ce6] px-6 py-5 text-white flex items-center justify-between border-b border-blue-400/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white text-[#005ce6] font-black flex items-center justify-center text-lg shadow-sm">
              G
            </div>
            <div>
              <h2 className="font-bold text-base tracking-tight leading-tight">GCash Checkout</h2>
              <p className="text-[11px] text-blue-100">Official Merchant: LaundriGo</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-blue-200 block uppercase font-semibold">Total Amount</span>
            <span className="text-xl font-extrabold tracking-tight">₱{parseFloat(initialAmount).toFixed(2)}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STAGE 1: Mobile Entry */}
          {stage === 'prompt_mobile' && (
            <form onSubmit={handleMobileSubmit} className="space-y-4">
              <div className="text-center mb-5">
                <Smartphone className="w-10 h-10 text-[#005ce6] mx-auto mb-2" />
                <h3 className="font-bold text-base text-gray-900">Enter GCash Registered Number</h3>
                <p className="text-xs text-gray-500 mt-0.5">Reference: {refNumber}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gcash-mobile" className="text-xs font-semibold text-gray-700">
                  Mobile Number
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-semibold text-gray-500">+63</span>
                  <Input
                    id="gcash-mobile"
                    type="tel"
                    placeholder="917 123 4567"
                    value={gcashMobile}
                    onChange={(e) => setGcashMobile(e.target.value)}
                    className="pl-12 font-medium"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#005ce6] hover:bg-[#004dc2] text-white py-3 rounded-xl font-bold shadow-md shadow-blue-500/20"
              >
                Next
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Encrypted 256-bit SSL transaction</span>
              </div>
            </form>
          )}

          {/* STAGE 2: OTP Verification */}
          {stage === 'prompt_otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="text-center mb-5">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#005ce6] flex items-center justify-center mx-auto mb-2 font-bold">
                  OTP
                </div>
                <h3 className="font-bold text-base text-gray-900">Enter 6-Digit Authentication Code</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Simulated OTP sent to <span className="font-semibold">{gcashMobile}</span> (Enter any 6 digits for testing, e.g. <span className="font-mono font-bold text-blue-600">123456</span>)
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="otp" className="text-xs font-semibold text-gray-700">
                  Authentication Code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="text-center text-xl tracking-widest font-mono font-bold h-12"
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStage('prompt_mobile')}
                  className="w-1/3"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="w-2/3 bg-[#005ce6] hover:bg-[#004dc2] text-white font-bold"
                >
                  Authorize Payment
                </Button>
              </div>
            </form>
          )}

          {/* STAGE 3: Processing */}
          {stage === 'processing' && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-[#005ce6] mx-auto" />
              <h3 className="font-bold text-base text-gray-900">Authorizing Payment...</h3>
              <p className="text-xs text-gray-500">Contacting bank servers & verifying transaction reference.</p>
            </div>
          )}

          {/* STAGE 4: Success Receipt */}
          {stage === 'success' && receiptData && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="font-extrabold text-xl text-gray-900">Payment Successful!</h3>
                <p className="text-xs text-gray-500 mt-0.5">Your payment was confirmed by LaundriGo.</p>
              </div>

              {/* Receipt Box */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-left text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Merchant</span>
                  <span className="font-semibold text-gray-900">LaundriGo Delivery</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Reference No.</span>
                  <span className="font-mono font-semibold text-gray-900">{receiptData.reference_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Payment Channel</span>
                  <span className="font-semibold text-blue-600">GCash E-Wallet</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Timestamp</span>
                  <span className="font-semibold text-gray-900">{receiptData.date}</span>
                </div>
                <div className="flex justify-between py-1 pt-2 font-bold text-sm">
                  <span>Amount Paid</span>
                  <span className="text-emerald-600">₱{receiptData.amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrintReceipt}
                  className="w-1/2 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/customer/orders')}
                  className="w-1/2 bg-[#005ce6] hover:bg-[#004dc2] text-white font-bold"
                >
                  View My Laundry
                </Button>
              </div>
            </div>
          )}

          {/* STAGE 5: Failure */}
          {stage === 'failed' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg text-gray-900">Transaction Failed</h3>
              <p className="text-xs text-gray-500">The GCash payment was not authorized. Please check your credentials or retry.</p>
              <Button
                onClick={() => setStage('prompt_mobile')}
                className="w-full bg-[#005ce6] text-white font-bold"
              >
                Retry Payment
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
