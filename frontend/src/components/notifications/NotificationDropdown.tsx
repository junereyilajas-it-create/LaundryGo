import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, type Notification } from '../../context/NotificationContext';
import { 
  Bell, Check, CheckCheck, Trash2, Settings, MoreHorizontal, 
  Shirt, CreditCard, Truck, ShieldCheck, ArrowRight, X, AlertTriangle 
} from 'lucide-react';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 45) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

export default function NotificationDropdown() {
  const {
    notifications,
    unreadCount,
    loading,
    isDropdownOpen,
    setIsDropdownOpen,
    activeTab,
    setActiveTab,
    setIsPreferencesOpen,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    handleNotificationClick
  } = useNotifications();

  const [activeItemMenuId, setActiveItemMenuId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close active item 3-dots menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveItemMenuId(null);
      }
    }
    if (activeItemMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeItemMenuId]);

  if (!isDropdownOpen) return null;

  // Filter list by tab
  const displayedNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const renderCategoryIcon = (type?: string) => {
    switch (type) {
      case 'payment':
        return (
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
        );
      case 'delivery':
        return (
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 shadow-xs">
            <Truck className="w-5 h-5" />
          </div>
        );
      case 'account':
      case 'system':
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 shadow-xs">
            <Shirt className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Facebook-Style Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-lg text-gray-900 dark:text-white tracking-tight">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                setIsPreferencesOpen(true);
                setIsDropdownOpen(false);
              }}
              className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              title="Notification Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {notifications.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Clear all notifications"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Facebook-Style Tabs: All vs Unread */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'unread'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'unread'
                    ? 'bg-white text-emerald-700'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <div className="p-4 bg-red-50/90 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900/60 space-y-2 animate-in fade-in duration-100">
          <div className="flex items-center gap-2 text-xs font-bold text-red-800 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Clear all notifications?</span>
          </div>
          <p className="text-[11px] text-red-700 dark:text-red-400 leading-snug">
            This will permanently remove all notifications from your account. This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                clearAllNotifications();
                setShowClearConfirm(false);
              }}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 custom-scrollbar">
        {loading && notifications.length === 0 ? (
          // Skeleton Loading State
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedNotifications.length === 0 ? (
          // Empty State
          <div className="p-10 text-center space-y-2.5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <Bell className="w-7 h-7 opacity-80" />
            </div>
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {activeTab === 'unread' ? "You're all caught up!" : 'No notifications yet'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
              {activeTab === 'unread'
                ? 'There are no unread notifications in your inbox.'
                : 'System alerts, laundry stages, payments, and delivery tracking updates will appear here.'}
            </p>
          </div>
        ) : (
          displayedNotifications.map((n) => {
            const isUnread = !n.is_read;
            const isMenuOpen = activeItemMenuId === n.id;

            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(n)}
                onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n)}
                className={`p-3.5 relative transition-all cursor-pointer group flex items-start gap-3 ${
                  isUnread
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/25 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30'
                    : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                {/* Category Avatar */}
                <div className="relative shrink-0">
                  {renderCategoryIcon(n.notification_type)}
                  {isUnread && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-600 ring-2 ring-white dark:ring-gray-900 rounded-full" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-start justify-between gap-1">
                    <h4
                      className={`text-xs leading-snug line-clamp-1 transition-colors ${
                        isUnread
                          ? 'font-bold text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400'
                          : 'font-semibold text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {n.title}
                    </h4>

                    {/* 3-dots Context Menu Button */}
                    <div
                      className="relative shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveItemMenuId(isMenuOpen ? null : n.id);
                      }}
                    >
                      <button
                        type="button"
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors opacity-70 group-hover:opacity-100"
                        title="Notification Options"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div
                          className="absolute right-0 top-6 w-40 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-1 z-50 text-xs font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isUnread ? (
                            <button
                              onClick={() => {
                                markAsRead(n.id);
                                setActiveItemMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-left"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Mark as read</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                markAsUnread(n.id);
                                setActiveItemMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-left"
                            >
                              <Bell className="w-3.5 h-3.5 text-blue-600" />
                              <span>Mark as unread</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              deleteNotification(n.id);
                              setActiveItemMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove this</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notification Body Message */}
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {n.message}
                  </p>

                  {/* Timestamp & Direct Link Indicator */}
                  <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-gray-100/60 dark:border-gray-800/60 text-[10px]">
                    <span className="text-gray-400 font-medium">
                      {formatRelativeTime(n.created_at)}
                    </span>

                    {(n.order_id || n.related_order_id) ? (
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 group-hover:underline flex items-center gap-0.5">
                        Order #{n.order_id || n.related_order_id} <ArrowRight className="w-2.5 h-2.5 inline" />
                      </span>
                    ) : (
                      <span className="font-medium text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-0.5">
                        View details <ArrowRight className="w-2.5 h-2.5 inline" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850/80 text-center">
          <button
            onClick={() => {
              setActiveTab('all');
            }}
            className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            {notifications.length} total notifications
          </button>
        </div>
      )}
    </div>
  );
}
