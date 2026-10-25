import React, { useEffect, useRef } from 'react';
import { Printer, X, Droplets, CheckCircle2, DollarSign, Calendar, User, FileText } from 'lucide-react';

interface PaymentRecord {
  id: number;
  order_id?: number;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  amount: number | string;
  payment_method: string;
  payment_status: string;
  reference_number?: string;
  created_at: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  payment
}: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const amountVal = parseFloat(String(payment.amount || 0)).toFixed(2);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Controls */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
              Official Laundry Receipt
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div 
          ref={receiptRef}
          className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700 space-y-4 font-sans text-xs sm:text-sm"
        >
          {/* Header */}
          <div className="text-center space-y-1 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center gap-1.5 font-black text-lg text-gray-900 dark:text-white">
              <Droplets className="w-5 h-5 text-blue-600" />
              <span>Laundri<span className="text-blue-600">Go</span></span>
            </div>
            <p className="text-[11px] text-gray-500">
              Poblacion, Lagonglong, Misamis Oriental, Philippines
            </p>
            <p className="text-[10px] text-gray-400 font-mono">
              Receipt Reference: PAY-{payment.id}
            </p>
          </div>

          {/* Details Grid */}
          <div className="space-y-2 py-1">
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Order Number:</span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">{payment.order_number}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Customer:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{payment.customer_name}</span>
            </div>
            {payment.customer_phone && (
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                <span>Contact:</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">{payment.customer_phone}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Date & Time:</span>
              <span className="text-gray-800 dark:text-gray-200">
                {new Date(payment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Payment Method:</span>
              <span className="font-bold uppercase text-blue-600 dark:text-blue-400">{payment.payment_method}</span>
            </div>
            {payment.reference_number && (
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                <span>Payment Ref / Trace:</span>
                <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{payment.reference_number}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
              <span>Payment Status:</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {payment.payment_status?.toUpperCase() || 'PAID'}
              </span>
            </div>
          </div>

          {/* Amount Total */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center font-bold">
            <span className="text-sm text-gray-900 dark:text-white uppercase tracking-wider">Total Paid</span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">₱{amountVal}</span>
          </div>

          <p className="text-center text-[10px] text-gray-400 pt-2">
            Thank you for choosing LaundriGo! Clean clothes, right to your doorstep.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
