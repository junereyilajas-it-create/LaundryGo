import React from 'react';
import { useNotifications, type Notification } from '../../context/NotificationContext';
import { X, Bell, Shirt, CreditCard, Truck, ShieldCheck, ArrowRight } from 'lucide-react';

export default function NotificationToast() {
  const { latestArrival, dismissToast, handleNotificationClick, isDropdownOpen } = useNotifications();

  // If dropdown is open or no arrival, do not show popover toast
  if (!latestArrival || isDropdownOpen) return null;

  const renderIcon = (type?: string) => {
    switch (type) {
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'delivery':
        return <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'account':
      case 'system':
        return <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Shirt className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div
      role="alert"
      className="fixed top-20 right-4 z-50 max-w-sm w-full bg-white dark:bg-gray-900 border border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-top-4 duration-200 cursor-pointer group"
      onClick={() => handleNotificationClick(latestArrival)}
    >
      <div className="flex items-start gap-3">
        {/* Category Avatar */}
        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-xs">
          {renderIcon(latestArrival.notification_type)}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              New Notification
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissToast();
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mt-0.5">
            {latestArrival.title}
          </h4>

          <p className="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2 mt-0.5 leading-snug">
            {latestArrival.message}
          </p>

          <div className="flex items-center gap-1 mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">
            <span>Tap to view details</span>
            <ArrowRight className="w-3 h-3 inline" />
          </div>
        </div>
      </div>
    </div>
  );
}
