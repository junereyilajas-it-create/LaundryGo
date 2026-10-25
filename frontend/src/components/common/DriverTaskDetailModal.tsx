import React, { useEffect } from 'react';
import { 
  Truck, MapPin, Phone, Calendar, Clock, Navigation, 
  Package, CheckCircle2, AlertTriangle, DollarSign, X, ArrowRight 
} from 'lucide-react';

interface LogisticsTask {
  id: number;
  order_id: number;
  order_number: string;
  service_name?: string;
  total_amount?: number;
  payment_status?: string;
  payment_method?: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  status: string;
  scheduled_date?: string;
  scheduled_time?: string;
  latitude?: number;
  longitude?: number;
  failure_reason?: string;
}

interface DriverTaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: LogisticsTask | null;
  taskType: 'pickup' | 'delivery';
  onAdvanceStatus: (id: number, type: 'pickup' | 'delivery', status: string) => void;
  onOpenNavigation: (task: LogisticsTask) => void;
  onOpenCodModal?: (task: LogisticsTask) => void;
  onOpenFailureModal?: (task: LogisticsTask, type: 'pickup' | 'delivery') => void;
}

export default function DriverTaskDetailModal({
  isOpen,
  onClose,
  task,
  taskType,
  onAdvanceStatus,
  onOpenNavigation,
  onOpenCodModal,
  onOpenFailureModal
}: DriverTaskDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
              taskType === 'pickup'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
            }`}>
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                  {taskType === 'pickup' ? 'Pickup Assignment' : 'Delivery Assignment'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  {task.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs font-mono text-gray-500">Order: {task.order_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer & Location Details */}
        <div className="space-y-3">
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Customer Name:</span>
              <span className="font-bold text-gray-900 dark:text-white">{task.customer_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Mobile Phone:</span>
              <a 
                href={`tel:${task.customer_phone}`} 
                className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />
                {task.customer_phone}
              </a>
            </div>
            <div className="flex justify-between items-start gap-2 pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
              <span className="text-gray-500 shrink-0">Address:</span>
              <span className="font-medium text-gray-900 dark:text-white text-right flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 inline" />
                {task.address_line}
              </span>
            </div>
          </div>

          {/* Service & Financial info */}
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Service:</span>
              <span className="font-bold text-gray-900 dark:text-white">{task.service_name || 'Standard Service'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Payment Method:</span>
              <span className="font-semibold uppercase text-gray-800 dark:text-gray-200">{task.payment_method || 'CASH'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Bill Amount:</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                ₱{parseFloat(String(task.total_amount || 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Payment Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                task.payment_status === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {task.payment_status?.toUpperCase() || 'UNPAID'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-2.5 pt-2">
          {/* Open Google Maps Direction */}
          <button
            onClick={() => onOpenNavigation(task)}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-blue-200 dark:border-blue-800"
          >
            <Navigation className="w-4 h-4" />
            <span>Open GPS Navigation Directions</span>
          </button>

          {/* Status Progression buttons */}
          {taskType === 'pickup' && (
            <>
              {task.status === 'assigned' && (
                <button
                  onClick={() => {
                    onAdvanceStatus(task.id, 'pickup', 'on_the_way');
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Truck className="w-4 h-4" />
                  <span>Start Travel (On the Way to Pickup)</span>
                </button>
              )}
              {task.status === 'on_the_way' && (
                <button
                  onClick={() => {
                    onAdvanceStatus(task.id, 'pickup', 'picked_up');
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Laundry Picked Up</span>
                </button>
              )}
            </>
          )}

          {taskType === 'delivery' && (
            <>
              {task.status === 'assigned' && (
                <button
                  onClick={() => {
                    onAdvanceStatus(task.id, 'delivery', 'on_the_way');
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Truck className="w-4 h-4" />
                  <span>Start Delivery (Out for Delivery)</span>
                </button>
              )}
              {task.status === 'on_the_way' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {task.payment_method?.toLowerCase() === 'cod' && task.payment_status !== 'paid' && onOpenCodModal && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenCodModal(task);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Collect Cash (COD)</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onAdvanceStatus(task.id, 'delivery', 'delivered');
                      onClose();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Delivered</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Failure report trigger */}
          {onOpenFailureModal && task.status !== 'picked_up' && task.status !== 'delivered' && task.status !== 'failed' && (
            <button
              onClick={() => {
                onClose();
                onOpenFailureModal(task, taskType);
              }}
              className="w-full py-2 px-3 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors font-semibold flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Report Delivery/Pickup Issue</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
