/**
 * LaundriGo Centralized Semantic Status & Color Mapping
 * Ensures uniform semantic colors across Orders, Payments, Tracking, Users, and Dashboard.
 */

export type SemanticColorCategory = 'payment' | 'order' | 'application' | 'sms';

export interface StatusStyle {
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
  textClass: string;
  isDemo?: boolean;
}

/**
 * Standard semantic color configurations for Payment Statuses
 */
export function getPaymentStatusConfig(status: string | null | undefined, isDemoPayment?: boolean | number): StatusStyle {
  const norm = (status || 'unpaid').trim().toLowerCase().replace(/_/g, ' ');

  if (norm.includes('demo') || (norm === 'paid' && Boolean(isDemoPayment))) {
    return {
      label: 'Paid (Demo)',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      dotClass: 'bg-emerald-500',
      borderClass: 'border-emerald-300 dark:border-emerald-800',
      textClass: 'text-emerald-700 dark:text-emerald-300',
      isDemo: true
    };
  }

  if (norm === 'paid') {
    return {
      label: 'Paid',
      badgeClass: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
      dotClass: 'bg-green-500',
      borderClass: 'border-green-200 dark:border-green-800',
      textClass: 'text-green-700 dark:text-green-300'
    };
  }

  if (norm === 'failed') {
    return {
      label: 'Failed',
      badgeClass: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
      dotClass: 'bg-red-500',
      borderClass: 'border-red-200 dark:border-red-800',
      textClass: 'text-red-700 dark:text-red-300'
    };
  }

  if (norm === 'refunded') {
    return {
      label: 'Refunded',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      dotClass: 'bg-purple-500',
      borderClass: 'border-purple-200 dark:border-purple-800',
      textClass: 'text-purple-700 dark:text-purple-300'
    };
  }

  if (norm.includes('pending verification')) {
    return {
      label: 'Pending Verification',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      dotClass: 'bg-amber-500',
      borderClass: 'border-amber-200 dark:border-amber-800',
      textClass: 'text-amber-700 dark:text-amber-300'
    };
  }

  if (norm.includes('pending') || norm === 'pending payment') {
    return {
      label: 'Pending Payment',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      dotClass: 'bg-amber-500',
      borderClass: 'border-amber-200 dark:border-amber-800',
      textClass: 'text-amber-700 dark:text-amber-300'
    };
  }

  if (norm === 'partially paid' || norm === 'partial') {
    return {
      label: 'Partially Paid',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      dotClass: 'bg-amber-500',
      borderClass: 'border-amber-200 dark:border-amber-800',
      textClass: 'text-amber-700 dark:text-amber-300'
    };
  }

  // Default / Unpaid (Red indicating action is required)
  return {
    label: 'Unpaid',
    badgeClass: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    dotClass: 'bg-red-500',
    borderClass: 'border-red-200 dark:border-red-800',
    textClass: 'text-red-700 dark:text-red-300'
  };
}

/**
 * Standard semantic color configurations for Order / Workflow Statuses
 */
export function getOrderStatusConfig(status: string | null | undefined): StatusStyle {
  const norm = (status || '').trim();

  switch (norm) {
    case 'Pending Approval':
    case 'Pending Request':
      return {
        label: 'Pending Approval',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500',
        borderClass: 'border-amber-200 dark:border-amber-800',
        textClass: 'text-amber-700 dark:text-amber-300'
      };

    case 'Approved':
    case 'Awaiting Pickup Assignment':
    case 'Confirmed':
      return {
        label: norm === 'Awaiting Pickup Assignment' ? 'Awaiting Pickup Assignment' : 'Approved',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        dotClass: 'bg-blue-500',
        borderClass: 'border-blue-200 dark:border-blue-800',
        textClass: 'text-blue-700 dark:text-blue-300'
      };

    case 'Driver Assigned':
    case 'Pickup Scheduled':
    case 'assigned':
      return {
        label: 'Driver Assigned',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
        dotClass: 'bg-purple-500',
        borderClass: 'border-purple-200 dark:border-purple-800',
        textClass: 'text-purple-700 dark:text-purple-300'
      };

    case 'Pickup in Progress':
    case 'on_the_way':
      return {
        label: 'Pickup in Progress',
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 animate-soft-pulse',
        dotClass: 'bg-orange-500',
        borderClass: 'border-orange-200 dark:border-orange-800',
        textClass: 'text-orange-700 dark:text-orange-300'
      };

    // Distinct recognized badge for Picked Up (visually different from pending & in progress)
    case 'Picked Up':
    case 'Laundry Received':
    case 'picked_up':
      return {
        label: norm === 'Laundry Received' ? 'Laundry Received' : 'Picked Up',
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-700 font-bold',
        dotClass: 'bg-teal-500',
        borderClass: 'border-teal-300 dark:border-teal-700',
        textClass: 'text-teal-700 dark:text-teal-300'
      };

    case 'Weighing':
    case 'Awaiting Customer Approval':
    case 'Awaiting Customer Confirmation':
      return {
        label: 'Weighing / Awaiting Final Price',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700 font-semibold',
        dotClass: 'bg-amber-500',
        borderClass: 'border-amber-300 dark:border-amber-700',
        textClass: 'text-amber-800 dark:text-amber-300'
      };

    case 'Processing':
    case 'Washing':
    case 'Drying':
    case 'Folding':
      return {
        label: norm === 'Processing' ? 'Processing' : `Processing (${norm})`,
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
        dotClass: 'bg-sky-500',
        borderClass: 'border-sky-200 dark:border-sky-800',
        textClass: 'text-sky-700 dark:text-sky-300'
      };

    case 'Ready for Delivery':
    case 'Ready':
      return {
        label: 'Ready for Delivery',
        badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
        dotClass: 'bg-cyan-500',
        borderClass: 'border-cyan-200 dark:border-cyan-800',
        textClass: 'text-cyan-700 dark:text-cyan-300'
      };

    case 'Out for Delivery':
    case 'Delivery in Progress':
    case 'Delivery Assigned':
    case 'out_for_delivery':
      return {
        label: 'Out for Delivery',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 animate-soft-pulse',
        dotClass: 'bg-indigo-500',
        borderClass: 'border-indigo-200 dark:border-indigo-800',
        textClass: 'text-indigo-700 dark:text-indigo-300'
      };

    case 'Completed':
    case 'Delivered':
    case 'delivered':
      return {
        label: norm === 'Delivered' ? 'Delivered' : 'Completed',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        dotClass: 'bg-emerald-500',
        borderClass: 'border-emerald-200 dark:border-emerald-800',
        textClass: 'text-emerald-700 dark:text-emerald-300'
      };

    case 'Cancelled':
    case 'Rejected':
    case 'Customer Rejected Weight Proposal':
      return {
        label: norm === 'Customer Rejected Weight Proposal' ? 'Proposal Rejected' : 'Cancelled',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
        dotClass: 'bg-gray-400',
        borderClass: 'border-gray-300 dark:border-gray-700',
        textClass: 'text-gray-600 dark:text-gray-400'
      };

    default:
      return {
        label: norm || 'Unknown',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
        dotClass: 'bg-gray-400',
        borderClass: 'border-gray-200 dark:border-gray-700',
        textClass: 'text-gray-600 dark:text-gray-400'
      };
  }
}

/**
 * Standard semantic color configurations for Driver Application Statuses
 */
export function getDriverAppStatusConfig(status: string | null | undefined): StatusStyle {
  const norm = (status || 'pending').toLowerCase();
  switch (norm) {
    case 'approved':
      return {
        label: 'Approved',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        dotClass: 'bg-emerald-500',
        borderClass: 'border-emerald-200 dark:border-emerald-800',
        textClass: 'text-emerald-700 dark:text-emerald-300'
      };
    case 'rejected':
      return {
        label: 'Rejected',
        badgeClass: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
        dotClass: 'bg-red-500',
        borderClass: 'border-red-200 dark:border-red-800',
        textClass: 'text-red-700 dark:text-red-300'
      };
    default:
      return {
        label: 'Pending',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500',
        borderClass: 'border-amber-200 dark:border-amber-800',
        textClass: 'text-amber-700 dark:text-amber-300'
      };
  }
}
