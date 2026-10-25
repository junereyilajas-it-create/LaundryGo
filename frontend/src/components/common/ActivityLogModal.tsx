import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { 
  Activity, Search, RefreshCw, X, ChevronLeft, ChevronRight, 
  User, Shield, Truck, Package, DollarSign, Key, AlertCircle, 
  CheckCircle2, XCircle, Calendar, Filter
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ActivityLog {
  id: number;
  actor_id: number | null;
  actor_name: string;
  actor_role: string;
  action_type: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  outcome: 'success' | 'failure';
  metadata: any;
  created_at: string;
}

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({ isOpen, onClose }) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [limit] = useState<number>(12);

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [actionCategory, setActionCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchActivities = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        limit,
      };

      if (roleFilter !== 'all') params.role = roleFilter;
      if (outcomeFilter !== 'all') params.outcome = outcomeFilter;
      if (actionCategory !== 'all') params.action_type = actionCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/activities', { params });
      setActivities(res.data.activities || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalCount(res.data.total || 0);
    } catch (err: any) {
      console.error('Failed to load activity logs:', err);
      setError(err?.response?.data?.message || 'Failed to fetch activity logs from server.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, page, limit, roleFilter, outcomeFilter, actionCategory, searchQuery, startDate, endDate]);

  useEffect(() => {
    if (isOpen) {
      fetchActivities();
    }
  }, [isOpen, fetchActivities]);

  // Reset page to 1 when filters change
  const handleFilterChange = (setter: (v: any) => void, val: any) => {
    setter(val);
    setPage(1);
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Admin</span>;
      case 'worker':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Worker</span>;
      case 'driver':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Driver</span>;
      case 'customer':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Customer</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{role || 'System'}</span>;
    }
  };

  const getActivityIcon = (actionType: string) => {
    if (actionType.startsWith('auth_') || actionType.includes('login') || actionType.includes('logout')) {
      return <Key className="w-4 h-4 text-amber-500" />;
    }
    if (actionType.startsWith('order_')) {
      return <Package className="w-4 h-4 text-blue-500" />;
    }
    if (actionType.startsWith('pickup_') || actionType.startsWith('delivery_') || actionType.includes('driver')) {
      return <Truck className="w-4 h-4 text-emerald-500" />;
    }
    if (actionType.startsWith('payment_') || actionType.includes('cod')) {
      return <DollarSign className="w-4 h-4 text-violet-500" />;
    }
    if (actionType.startsWith('user_') || actionType.includes('driver_approved') || actionType.includes('driver_rejected')) {
      return <Shield className="w-4 h-4 text-sky-500" />;
    }
    return <Activity className="w-4 h-4 text-gray-500" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-gray-900 dark:to-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">System Activity Logs</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium">
                  {totalCount} Total Entries
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Audited operations across authentication, laundry orders, logistics, payments, and users
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchActivities()}
              disabled={loading}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search actor, description, ID..."
                value={searchQuery}
                onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400 hidden sm:inline" />
              <select
                value={roleFilter}
                onChange={(e) => handleFilterChange(setRoleFilter, e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="worker">Worker</option>
                <option value="driver">Driver</option>
                <option value="customer">Customer</option>
                <option value="system">System / Anonymous</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 hidden sm:inline" />
              <select
                value={actionCategory}
                onChange={(e) => handleFilterChange(setActionCategory, e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Activities</option>
                <option value="auth">Authentication & Accounts</option>
                <option value="order">Laundry Orders</option>
                <option value="pickup">Pickups & Logistics</option>
                <option value="delivery">Deliveries</option>
                <option value="payment">Payments & COD</option>
                <option value="driver">Driver Applications</option>
                <option value="user">User Management</option>
              </select>
            </div>

            {/* Outcome Filter */}
            <div>
              <select
                value={outcomeFilter}
                onChange={(e) => handleFilterChange(setOutcomeFilter, e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Outcomes</option>
                <option value="success">Successful</option>
                <option value="failure">Failed / Blocked</option>
              </select>
            </div>
          </div>

          {/* Date range filter row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5" /> Date Range:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {(startDate || endDate || searchQuery || roleFilter !== 'all' || outcomeFilter !== 'all' || actionCategory !== 'all') && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSearchQuery('');
                    setRoleFilter('all');
                    setOutcomeFilter('all');
                    setActionCategory('all');
                    setPage(1);
                  }}
                  className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm font-medium">Loading live activity history...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-500 dark:text-red-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-sm">{error}</p>
              <button
                onClick={() => fetchActivities()}
                className="mt-3 px-4 py-1.5 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-20 text-center text-gray-400 dark:text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No activity records found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                No system events match your current filter criteria. Try broadening your search or date range.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div 
                  key={act.id}
                  className="p-3.5 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900/50 bg-white dark:bg-gray-800/60 hover:bg-blue-50/30 dark:hover:bg-gray-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0 mt-0.5">
                      {getActivityIcon(act.action_type)}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          {act.actor_name || 'System User'}
                        </span>
                        {getRoleBadge(act.actor_role)}
                        {act.outcome === 'failure' ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Success
                          </span>
                        )}
                        {act.entity_type && act.entity_id && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
                            {act.entity_type} #{act.entity_id}
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {act.description}
                      </p>

                      {act.metadata && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {Object.entries(act.metadata).map(([k, v]) => {
                            if (typeof v === 'object' || v === null || v === undefined) return null;
                            return (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/60 rounded text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{k}:</span> {String(v)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800/80">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {format(new Date(act.created_at), 'MMM dd, yyyy h:mm a')}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <div>
            Showing <span className="font-semibold text-gray-900 dark:text-gray-200">{activities.length}</span> of{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-200">{totalCount}</span> records (Page {page} of {totalPages})
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 font-medium"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ActivityLogModal;
