import React from 'react';
import { 
  getPaymentStatusConfig, 
  getOrderStatusConfig, 
  getDriverAppStatusConfig,
  type SemanticColorCategory 
} from '../../lib/statusConfig';

interface StatusBadgeProps {
  status: string | null | undefined;
  type?: SemanticColorCategory;
  isDemo?: boolean | number;
  className?: string;
  showDot?: boolean;
}

export default function StatusBadge({
  status,
  type = 'order',
  isDemo = false,
  className = '',
  showDot = true
}: StatusBadgeProps) {
  let config = getOrderStatusConfig(status);

  if (type === 'payment') {
    config = getPaymentStatusConfig(status, isDemo);
  } else if (type === 'application') {
    config = getDriverAppStatusConfig(status);
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shadow-2xs ${config.badgeClass} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} />
      )}
      <span>{config.label}</span>
      {config.isDemo && (
        <span className="ml-0.5 px-1 py-0.2 rounded text-[10px] font-bold tracking-wider bg-emerald-600 text-white uppercase dark:bg-emerald-700">
          Demo
        </span>
      )}
    </span>
  );
}
