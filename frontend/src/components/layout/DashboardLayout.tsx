import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  LayoutDashboard, 
  Map, Plus, Menu, X, Bell, LogOut, Sun, Moon, Droplets
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminNav: NavItem[] = [
    { name: 'Dashboard', href: '/worker', icon: <LayoutDashboard size={20} /> },
    { name: 'Tracking & Map', href: '/worker/tracking', icon: <Map size={20} /> },
    // more links can be added based on the actual worker routes...
  ];

  const customerNav: NavItem[] = [
    { name: 'Dashboard', href: '/customer', icon: <LayoutDashboard size={20} /> },
    { name: 'Request Service', href: '/customer/request', icon: <Plus size={20} /> },
  ];

  const driverNav: NavItem[] = [
    { name: 'Dashboard', href: '/driver', icon: <LayoutDashboard size={20} /> },
  ];

  const currentNav = user?.role === 'customer' ? customerNav : (user?.role === 'driver' ? driverNav : adminNav);

  const isActive = (path: string) => {
    if (path === '/' || path === '/customer' || path === '/worker' || path === '/driver') {
      return location.pathname === path || location.pathname === path + '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-on-background/20 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SideNavBar */}
      <aside className={`fixed top-0 left-0 h-screen w-64 bg-surface-container-low dark:bg-inverse-surface border-r border-outline-variant/50 dark:border-outline/30 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-lg py-xl flex items-center justify-between">
          <Link to="/" className="flex items-center gap-sm">
            <div className="bg-primary-container p-xs rounded-md text-on-primary">
              <Droplets size={24} />
            </div>
            <div>
              <h1 className="font-h3 text-h3 text-primary dark:text-primary-fixed font-bold leading-none tracking-tight">LaundryGo</h1>
              <p className="font-label-md text-[10px] text-secondary opacity-80 mt-1 uppercase tracking-widest">Management</p>
            </div>
          </Link>
          <button className="md:hidden text-on-surface-variant" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-xs overflow-y-auto px-md pb-xl custom-scrollbar">
          {currentNav.map((item) => (
            <Link 
              key={item.name} 
              to={item.href}
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-md py-sm px-md rounded-lg transition-all duration-200 ${
                isActive(item.href) 
                ? 'bg-primary dark:bg-primary-fixed text-on-primary dark:text-on-primary-fixed shadow-sm font-medium scale-[0.98]' 
                : 'text-secondary dark:text-secondary-fixed-dim hover:bg-surface-container dark:hover:bg-surface-container-highest font-normal hover:translate-x-1'
              }`}
            >
              {item.icon}
              <span className="font-label-md text-label-md">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-xs p-md border-t border-outline-variant/30">
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center gap-md py-sm px-md text-secondary dark:text-secondary-fixed-dim hover:bg-surface-container dark:hover:bg-surface-container-highest rounded-lg transition-all"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span className="font-label-md text-label-md">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-md py-sm px-md text-error hover:bg-error-container rounded-lg transition-all"
          >
            <LogOut size={20} />
            <span className="font-label-md text-label-md">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* TopAppBar */}
        <header className="bg-surface/80 dark:bg-on-background/80 backdrop-blur-md shadow-sm border-b border-outline-variant/20 sticky top-0 z-30 flex justify-between items-center px-lg py-md transition-colors">
          <div className="flex items-center gap-md">
            <button className="md:hidden text-primary p-xs rounded-md hover:bg-surface-container" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="font-h3 text-[20px] font-semibold text-primary dark:text-primary-fixed-dim hidden sm:block">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}
            </h2>
          </div>
          
          <div className="flex items-center gap-sm sm:gap-md">
            <button className="text-on-surface-variant hover:bg-surface-container-low p-sm rounded-full transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-error ring-2 ring-surface" />
            </button>
            <div className="flex items-center gap-sm bg-surface-container-low dark:bg-surface-container-highest py-xs px-sm rounded-full border border-outline-variant/30">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block mr-xs">
                <p className="font-label-md text-[12px] font-semibold text-on-surface leading-tight">{user?.name}</p>
                <p className="text-[10px] text-secondary capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <main className="p-md sm:p-lg lg:p-xl w-full flex-grow relative">
          {children}
        </main>
      </div>
    </div>
  );
}
