import React, { useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { Bell } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

export default function NotificationBell() {
  const { unreadCount, isDropdownOpen, setIsDropdownOpen, hasNewArrival } = useNotifications();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside the bell or dropdown container
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen, setIsDropdownOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id="notification-bell-button"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isDropdownOpen}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`relative p-2 rounded-2xl transition-all duration-200 outline-none ${
          isDropdownOpen
            ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        } ${hasNewArrival ? 'animate-bell-shake' : ''}`}
      >
        <Bell className={`w-5 h-5 transition-transform ${hasNewArrival ? 'scale-110 text-emerald-600' : ''}`} />

        {/* Red Notification Badge */}
        {unreadCount > 0 && (
          <span
            id="notification-unread-badge"
            className="absolute -top-0.5 -right-0.5 flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white ring-2 ring-white dark:ring-gray-900 shadow-sm animate-in zoom-in-75 duration-150"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Facebook Style Dropdown Panel */}
      <NotificationDropdown />
    </div>
  );
}
