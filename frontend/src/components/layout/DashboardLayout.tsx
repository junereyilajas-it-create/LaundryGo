import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { 
  LayoutDashboard, Map, Plus, Menu, X, Bell, LogOut, Sun, Moon, Droplets,
  Package, Users, Truck, DollarSign, User, Settings, ExternalLink,
  BarChart3, Trash2, Check, ArrowRight, Smartphone
} from 'lucide-react';
import MobilePreviewModal from '../common/MobilePreviewModal';
import NotificationBell from '../notifications/NotificationBell';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'android' | 'ios'>('ios');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">

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

              {/* Mobile Preview Button (Desktop only) */}
              <button
                onClick={() => setIsMobilePreviewOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs font-semibold"
                title="Preview Mobile Smartphone Layout"
              >
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden xl:inline">Mobile Preview</span>
              </button>

              {/* Facebook-Style Real-Time Notification Bell */}
              <NotificationBell />

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
