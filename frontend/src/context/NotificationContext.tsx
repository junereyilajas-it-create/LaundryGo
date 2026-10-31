import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

export interface Notification {
  id: number;
  user_id: number;
  order_id?: number | null;
  related_order_id?: number | null;
  related_user_id?: number | null;
  title: string;
  message: string;
  notification_type?: 'order' | 'payment' | 'delivery' | 'account' | 'system' | string;
  target_url?: string | null;
  is_read: number;
  created_at: string;
  read_at?: string | null;
}

export interface NotificationPreferences {
  laundry_updates: boolean;
  payment_updates: boolean;
  delivery_updates: boolean;
  account_updates: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  activeTab: 'all' | 'unread';
  setActiveTab: (tab: 'all' | 'unread') => void;
  hasNewArrival: boolean;
  latestArrival: Notification | null;
  dismissToast: () => void;
  preferences: NotificationPreferences;
  isPreferencesOpen: boolean;
  setIsPreferencesOpen: (open: boolean) => void;
  fetchNotifications: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (newPrefs: Partial<NotificationPreferences>) => Promise<boolean>;
  markAsRead: (id: number) => Promise<void>;
  markAsUnread: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  handleNotificationClick: (n: Notification) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Optional subtle audio chime synthesized using Web Audio API
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First gentle tone (E5 ~ 659Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.25);

    // Second sparkling tone (G#5 ~ 830Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(830.61, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // Audio playback policy silent catch
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [hasNewArrival, setHasNewArrival] = useState<boolean>(false);
  const [latestArrival, setLatestArrival] = useState<Notification | null>(null);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    laundry_updates: true,
    payment_updates: true,
    delivery_updates: true,
    account_updates: true
  });

  const socketRef = useRef<Socket | null>(null);

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data } = await api.get('/notifications');
      if (Array.isArray(data)) {
        setNotifications(data);
        const unread = data.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications/preferences');
      if (data) {
        setPreferences({
          laundry_updates: Boolean(data.laundry_updates),
          payment_updates: Boolean(data.payment_updates),
          delivery_updates: Boolean(data.delivery_updates),
          account_updates: Boolean(data.account_updates)
        });
      }
    } catch (err) {
      console.warn('Error fetching notification preferences:', err);
    }
  }, [user]);

  // Update preferences
  const updatePreferences = async (newPrefs: Partial<NotificationPreferences>): Promise<boolean> => {
    try {
      const merged = { ...preferences, ...newPrefs };
      const { data } = await api.put('/notifications/preferences', merged);
      if (data?.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences(merged);
      }
      return true;
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      return false;
    }
  };

  // Socket.IO Setup
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();
    fetchPreferences();

    const token = localStorage.getItem('token');
    if (!token) return;

    // Connect to Socket.IO server
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket: Socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ [Socket.IO] Connected to real-time notification engine.');
      // Sync missed notifications after reconnect
      fetchNotifications();
    });

    // Listen to real-time new notification
    socket.on('notification:new', (newNotification: Notification) => {
      console.log('🔔 [Socket.IO] New notification received:', newNotification);

      setNotifications((prev) => {
        // Prevent duplicate in state
        if (prev.some((n) => n.id === newNotification.id)) return prev;
        return [newNotification, ...prev];
      });

      setUnreadCount((prev) => prev + 1);

      // Trigger bell wiggle animation & toast banner
      setHasNewArrival(true);
      setLatestArrival(newNotification);
      playNotificationChime();

      setTimeout(() => {
        setHasNewArrival(false);
      }, 2500);

      // Auto-hide popup toast preview after 5s
      setTimeout(() => {
        setLatestArrival((curr) => (curr?.id === newNotification.id ? null : curr));
      }, 5000);
    });

    // Listen to direct unread count updates
    socket.on('notification:unread_count', (data: { count: number }) => {
      if (typeof data.count === 'number') {
        setUnreadCount(data.count);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ [Socket.IO] Disconnected:', reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, fetchNotifications, fetchPreferences]);

  const dismissToast = () => {
    setLatestArrival(null);
  };

  // Mark single as read
  const markAsRead = async (id: number) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: 1, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.put(`/notifications/${id}/read`);
    } catch (err) {
      console.error('Error marking as read:', err);
      fetchNotifications();
    }
  };

  // Mark single as unread
  const markAsUnread = async (id: number) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: 0, read_at: null } : n))
    );
    setUnreadCount((prev) => prev + 1);

    try {
      await api.put(`/notifications/${id}/unread`);
    } catch (err) {
      console.error('Error marking as unread:', err);
      fetchNotifications();
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: 1, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await api.put('/notifications/read-all');
    } catch (err) {
      console.error('Error marking all as read:', err);
      fetchNotifications();
    }
  };

  // Delete individual notification
  const deleteNotification = async (id: number) => {
    const item = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (item && !item.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error('Error deleting notification:', err);
      fetchNotifications();
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);

    try {
      await api.delete('/notifications/clear-all');
    } catch (err) {
      console.error('Error clearing notifications:', err);
      fetchNotifications();
    }
  };

  // Smart Click handler with friendly missing record handling
  const handleNotificationClick = async (n: Notification) => {
    // Automatically mark as read
    if (!n.is_read) {
      markAsRead(n.id);
    }
    setIsDropdownOpen(false);
    dismissToast();

    // Check if target URL exists directly
    if (n.target_url) {
      // Validate order existence if orderId is specified
      const orderId = n.order_id || n.related_order_id;
      if (orderId) {
        try {
          await api.get(`/orders/${orderId}`);
          navigate(n.target_url);
          return;
        } catch (err: any) {
          if (err.response?.status === 404) {
            alert('This laundry order or record is no longer available or was archived.');
            return;
          }
        }
      }
      navigate(n.target_url);
      return;
    }

    // Fallback role-based navigation mapping
    const titleLower = (n.title || '').toLowerCase();
    const msgLower = (n.message || '').toLowerCase();
    const combined = `${titleLower} ${msgLower}`;
    const orderId = n.order_id || n.related_order_id;

    if (user?.role === 'customer') {
      if (orderId) {
        navigate(`/customer/orders?orderId=${orderId}`);
      } else if (combined.includes('payment') || combined.includes('paid') || combined.includes('gcash')) {
        navigate('/customer/payments');
      } else if (combined.includes('driver') || combined.includes('pickup') || combined.includes('delivery')) {
        navigate('/customer/tracking');
      } else {
        navigate('/customer/orders');
      }
    } else if (user?.role === 'worker' || user?.role === 'admin') {
      if (combined.includes('driver application') || combined.includes('applicant') || combined.includes('driver registration')) {
        if (user.role === 'admin') {
          navigate('/worker/users?tab=applications');
        } else {
          navigate('/worker/orders');
        }
      } else if (orderId) {
        navigate(`/worker/orders?orderId=${orderId}`);
      } else if (combined.includes('payment') || combined.includes('paid')) {
        navigate('/worker/payments');
      } else if (combined.includes('driver location') || combined.includes('tracking')) {
        navigate('/worker/tracking');
      } else {
        navigate('/worker/orders');
      }
    } else if (user?.role === 'driver') {
      if (orderId) {
        navigate(`/driver?orderId=${orderId}`);
      } else if (combined.includes('application') || combined.includes('approved') || combined.includes('rejected')) {
        navigate('/driver/profile');
      } else if (combined.includes('map') || combined.includes('navigation') || combined.includes('pickup') || combined.includes('delivery')) {
        navigate('/driver/map');
      } else {
        navigate('/driver');
      }
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        isDropdownOpen,
        setIsDropdownOpen,
        activeTab,
        setActiveTab,
        hasNewArrival,
        latestArrival,
        dismissToast,
        preferences,
        isPreferencesOpen,
        setIsPreferencesOpen,
        fetchNotifications,
        fetchPreferences,
        updatePreferences,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        handleNotificationClick
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
