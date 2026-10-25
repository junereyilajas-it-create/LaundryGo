import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { 
  LayoutDashboard, Map, Plus, Menu, X, Bell, LogOut, Sun, Moon, Droplets,
  Package, Users, Truck, DollarSign, User, Settings, Download, ExternalLink,
  BarChart3, Trash2, Check, ArrowRight, Smartphone
} from 'lucide-react';
import InstallAppModal from '../common/InstallAppModal';
import MobilePreviewModal from '../common/MobilePreviewModal';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

interface Notification {
  id: number;
  order_id?: number | null;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'android' | 'ios'>('ios');

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 5000); // 5s live polling
      return () => clearInterval(interval);
    }
  }, [user]);

  // Capture PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    setIsInstallModalOpen(true);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch (err) {
      // silent catch for polling
    }
  };

  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      handleMarkAsRead(n.id);
    }
    setIsNotifOpen(false);

    const titleLower = (n.title || '').toLowerCase();
    const msgLower = (n.message || '').toLowerCase();
    const combined = `${titleLower} ${msgLower}`;

    // Role-based exact navigation mapping
    if (user?.role === 'customer') {
      if (n.order_id) {
        navigate(`/customer/orders?orderId=${n.order_id}`);
      } else if (combined.includes('payment') || combined.includes('paid')) {
        navigate('/customer/payments');
      } else if (combined.includes('driver') || combined.includes('pickup') || combined.includes('delivery')) {
        navigate('/customer/tracking');
      } else {
        navigate('/customer/orders');
      }
    } else if (user?.role === 'worker' || user?.role === 'admin') {
      if (combined.includes('driver application') || combined.includes('application submitted') || combined.includes('applicant')) {
        if (user.role === 'admin') {
          navigate('/worker/users?tab=applications');
        } else {
          navigate('/worker/orders');
        }
      } else if (n.order_id) {
        navigate(`/worker/orders?orderId=${n.order_id}`);
      } else if (combined.includes('payment') || combined.includes('paid')) {
        navigate('/worker/payments');
      } else if (combined.includes('driver location') || combined.includes('tracking')) {
        navigate('/worker/tracking');
      } else {
        navigate('/worker/orders');
      }
    } else if (user?.role === 'driver') {
      if (n.order_id) {
        navigate('/driver');
      } else if (combined.includes('application') || combined.includes('approved') || combined.includes('rejected')) {
        navigate('/driver/profile');
      } else if (combined.includes('map') || combined.includes('navigation') || combined.includes('pickup') || combined.includes('delivery')) {
        navigate('/driver/map');
      } else {
        navigate('/driver');
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Navigations with strict role-based access
  const adminNav: NavItem[] = [
    { name: 'Dashboard', href: '/worker', icon: LayoutDashboard },
    { name: 'Orders', href: '/worker/orders', icon: Package },
    { name: 'Reports', href: '/worker/reports', icon: BarChart3 },
    { name: 'User Management', href: '/worker/users', icon: Users },
    { name: 'Payments', href: '/worker/payments', icon: DollarSign },
    { name: 'Live Tracking', href: '/worker/tracking', icon: Map },
    { name: 'Services & Rates', href: '/worker/settings', icon: Settings },
  ];

  const workerNav: NavItem[] = [
    { name: 'Dashboard', href: '/worker', icon: LayoutDashboard },
    { name: 'Orders', href: '/worker/orders', icon: Package },
    { name: 'Payments', href: '/worker/payments', icon: DollarSign },
    { name: 'Live Tracking', href: '/worker/tracking', icon: Map },
    { name: 'Services & Rates', href: '/worker/settings', icon: Settings },
  ];

  const customerNav: NavItem[] = [
    { name: 'Dashboard', href: '/customer', icon: LayoutDashboard },
    { name: 'My Laundry', href: '/customer/orders', icon: Package },
    { name: 'Track Driver', href: '/customer/tracking', icon: Map },
    { name: 'Payments', href: '/customer/payments', icon: DollarSign },
    { name: 'My Profile', href: '/customer/profile', icon: User },
  ];

  const driverNav: NavItem[] = [
    { name: 'Dashboard', href: '/driver', icon: LayoutDashboard },
    { name: 'Navigation Map', href: '/driver/map', icon: Map },
    { name: 'History', href: '/driver/history', icon: Package },
    { name: 'Driver Profile', href: '/driver/profile', icon: User },
  ];

  const currentNav = 
    user?.role === 'customer' 
      ? customerNav 
      : user?.role === 'driver' 
        ? driverNav 
        : user?.role === 'admin' 
          ? adminNav 
          : workerNav;

  const isActive = (path: string) => {
    if (path === '/' || path === '/customer' || path === '/worker' || path === '/driver') {
      return location.pathname === path || location.pathname === path + '/';
    }
    return location.pathname.startsWith(path);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className={`flex min-h-screen w-full ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="flex w-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 relative">
        
        {/* Mobile Sidebar Overlay */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Desktop & Tablet Sidebar */}
        <nav
          className={`fixed md:sticky top-0 h-screen shrink-0 border-r transition-all duration-300 ease-in-out z-50 flex flex-col ${
            isDesktopOpen ? 'w-64' : 'w-16'
          } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm`}
        >
          {/* Brand Header */}
          <div className="border-b border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="grid size-10 shrink-0 place-content-center rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 text-white shadow-md shadow-blue-500/20">
                <Droplets size={22} />
              </div>
              {isDesktopOpen && (
                <div className="hidden md:block overflow-hidden">
                  <span className="block text-base font-extrabold tracking-tight text-gray-900 dark:text-white leading-none">
                    Laundri<span className="text-blue-600 dark:text-blue-400">Go</span>
                  </span>
                  <span className="block text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-0.5">
                    Poblacion • {user?.role || 'User'}
                  </span>
                </div>
              )}
              <div className="md:hidden">
                <span className="block text-base font-extrabold text-gray-900 dark:text-white leading-none">
                  Laundri<span className="text-blue-600">Go</span>
                </span>
                <span className="block text-[10px] text-gray-400 capitalize mt-0.5">
                  {user?.role || 'User'}
                </span>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <div className="flex-1 space-y-1.5 p-3 overflow-y-auto custom-scrollbar">
            {currentNav.map((item) => {
              const selected = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`relative flex h-11 w-full items-center rounded-xl transition-all duration-200 ${
                    selected 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  title={!isDesktopOpen ? item.name : undefined}
                >
                  <div className="grid h-full w-12 shrink-0 place-content-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-sm transition-opacity duration-200 whitespace-nowrap overflow-hidden ${
                      isDesktopOpen ? 'opacity-100 md:opacity-100' : 'opacity-100 md:opacity-0 md:hidden'
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Sidebar Footer with PWA Install Prompt */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
            {isInstallable && isDesktopOpen && (
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Install LaundriGo App
              </button>
            )}

            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-blue-600 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {isDesktopOpen && <span>Landing Page</span>}
            </Link>
          </div>
        </nav>

        {/* Main Content Viewport */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          
          {/* Top App Header */}
          <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 px-4 md:px-8 backdrop-blur-md">
            
            {/* Left Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsDesktopOpen(!isDesktopOpen)}
                className="hidden md:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="hidden sm:block">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block">
                  LaundriGo Delivery
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Poblacion, Lagonglong • Philippines
                </span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Install App Button - Always clearly visible near top on both desktop and mobile */}
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
                title="Install LaundriGo App (PWA)"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden sm:inline">Install App</span>
                <span className="sm:hidden text-[11px]">Install</span>
              </button>

              {/* Mobile Preview Button (Desktop only) */}
              <button
                onClick={() => setIsMobilePreviewOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs font-semibold"
                title="Preview Mobile Smartphone Layout"
              >
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden xl:inline">Mobile Preview</span>
              </button>

              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between p-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-850">
                      <div>
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          <span>Notifications</span>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                              {unreadCount} new
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-gray-500">Click to view relevant order or action</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          >
                            Mark all read
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={handleClearAllNotifications}
                            className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium"
                            title="Clear all notifications"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-400">
                          <Bell className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2 opacity-50" />
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleNotificationClick(n)}
                            onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n)}
                            className={`p-3.5 cursor-pointer transition-all hover:bg-blue-50/40 dark:hover:bg-blue-900/20 focus:outline-none focus:bg-blue-50/60 dark:focus:bg-blue-900/30 group ${
                              n.is_read ? 'opacity-70 bg-transparent' : 'bg-blue-50/60 dark:bg-blue-950/25 border-l-4 border-l-blue-600'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {n.title}
                              </h4>
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {!n.is_read && (
                                  <button
                                    onClick={(e) => handleMarkAsRead(n.id, e)}
                                    title="Mark as read"
                                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleDeleteNotification(n.id, e)}
                                  title="Delete notification"
                                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                              {n.message}
                            </p>

                            <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-gray-100/60 dark:border-gray-800/60 text-[10px]">
                              <span className="text-gray-400">
                                {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>

                              {n.order_id ? (
                                <span className="font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
                                  Order #{n.order_id} <ArrowRight className="w-2.5 h-2.5 inline" />
                                </span>
                              ) : (
                                <span className="font-medium text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-0.5">
                                  View details <ArrowRight className="w-2.5 h-2.5 inline" />
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Profile Avatar & Menu */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-sky-400 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-2 z-50">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.name}</p>
                      <p className="text-xs text-blue-600 capitalize font-medium">{user?.role}</p>
                    </div>

                    <Link
                      to={`/${user?.role === 'customer' ? 'customer/profile' : user?.role === 'driver' ? 'driver/profile' : 'worker/settings'}`}
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <User className="w-4 h-4" />
                      Account Settings
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-left mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

            </div>
          </header>

          {/* Main View with padding at bottom on mobile to accommodate bottom nav */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
            {children}
          </main>

          {/* Mobile Bottom Sticky Navigation (HCI & Nielsen Usability: Easy Thumb Reach on Mobile) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-800 py-1.5 px-2 flex justify-around items-center shadow-lg backdrop-blur-md pb-[max(0.375rem,env(safe-area-inset-bottom))]">
            {currentNav.slice(0, currentNav.length > 5 ? 4 : 5).map((item) => {
              const selected = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${
                    selected
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] tracking-tight truncate max-w-[64px] text-center">{item.name}</span>
                </Link>
              );
            })}

            {/* If more than 5 tabs exist (e.g. Admin), show "More" button that toggles the drawer */}
            {currentNav.length > 5 && (
              <button
                onClick={() => setIsMobileOpen(true)}
                className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <Menu className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] tracking-tight">More</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* PWA Install Guide Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallAccepted={() => setIsInstallable(false)}
        onOpenPreview={(platform) => {
          setPreviewDevice(platform);
          setIsMobilePreviewOpen(true);
        }}
      />

      {/* Desktop Mobile Smartphone Preview Modal */}
      <MobilePreviewModal
        isOpen={isMobilePreviewOpen}
        onClose={() => setIsMobilePreviewOpen(false)}
        initialPath={location.pathname + location.search}
        initialDevice={previewDevice}
      />
    </div>
  );
}
