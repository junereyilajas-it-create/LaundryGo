import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, Truck, UserCheck, Shield, Search, Plus, 
  Edit, Power, Eye, X, AlertCircle, RefreshCw, 
  CheckCircle2, Phone, Mail, Calendar, Package, AlertTriangle,
  MessageSquare, Send, Check, Clock, XCircle, Trash2
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui';
import ConfirmModal, { type ConfirmModalProps } from '../../components/common/ConfirmModal';

interface CustomerUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
  is_active: number;
  approval_status?: string;
  total_orders: number;
}

interface DriverUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
  is_active: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  application_status?: 'pending' | 'approved' | 'rejected';
  applied_at?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  sms_status?: 'not_sent' | 'sent' | 'failed' | 'not_configured';
  sms_sent_at?: string;
  sms_reference?: string;
  sms_error?: string;
  active_pickups: number;
  active_deliveries: number;
  completed_tasks: number;
}

interface WorkerUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
  is_active: number;
  approval_status?: string;
  completed_processing_tasks: number;
}

interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
  is_active: number;
  approval_status?: string;
}

interface DriverApplication {
  id: number;
  user_id: number;
  status: 'pending' | 'approved' | 'rejected';
  applied_at: string;
  reviewed_at?: string;
  reviewed_by?: number;
  reviewer_name?: string;
  rejection_reason?: string;
  sms_status: 'not_sent' | 'sent' | 'failed' | 'not_configured';
  sms_sent_at?: string;
  sms_reference?: string;
  sms_error?: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string;
  user_is_active?: number;
}

interface UserSummaryData {
  customers: CustomerUser[];
  drivers: DriverUser[];
  workers: WorkerUser[];
  admins: AdminUser[];
  driverApplications: DriverApplication[];
  totals: {
    customers: number;
    drivers: number;
    workers: number;
    admins: number;
    pendingDrivers: number;
  };
}

export default function WorkerUsers() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'applications' | 'customers' | 'drivers' | 'workers' | 'admins'>('applications');
  const [data, setData] = useState<UserSummaryData>({
    customers: [],
    drivers: [],
    workers: [],
    admins: [],
    driverApplications: [],
    totals: { customers: 0, drivers: 0, workers: 0, admins: 0, pendingDrivers: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Track specific action in progress (driver ID & action type) for responsive spinners & debounce
  const [actionLoadingId, setActionLoadingId] = useState<{ id: number; action: string } | null>(null);

  // Add / Edit User Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [targetRole, setTargetRole] = useState<'customer' | 'driver' | 'worker'>('customer');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);

  // Driver Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetDriver, setRejectTargetDriver] = useState<{ id: number; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('Incomplete driver license or vehicle requirements');
  const [submittingReject, setSubmittingReject] = useState(false);

  // View Details Modal State
  const [detailUser, setDetailUser] = useState<any | null>(null);

  // Accessible Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<ConfirmModalProps | null>(null);

  // Action feedback / notification banner
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string; subText?: string } | null>(null);

  // Sync tab with URL query param if supplied
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['applications', 'customers', 'drivers', 'workers', 'admins'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const fetchUsersSummary = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/users/summary');
      setData(res.data);
    } catch (error: any) {
      console.error('Error fetching users summary:', error);
      if (error.response?.status === 403) {
        setActionMessage({ 
          type: 'error', 
          text: 'Access Denied: User Management is restricted to Administrators.' 
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersSummary();
    const interval = setInterval(() => fetchUsersSummary(true), 8000); // 8s live sync
    return () => clearInterval(interval);
  }, []);

  // 1. Approve Driver Application
  const handleApproveDriver = (driverId: number, driverName: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Approve Driver Application',
      message: (
        <div className="space-y-2">
          <p>Approve driver application for <strong className="text-gray-900 dark:text-white">{driverName}</strong>?</p>
          <p className="text-xs text-gray-500">This will activate the account and dispatch an approval SMS notification with login credentials.</p>
        </div>
      ),
      confirmText: 'Approve Driver',
      variant: 'success',
      onClose: () => setConfirmConfig(null),
      onConfirm: async () => {
        setConfirmConfig(null);
        setActionLoadingId({ id: driverId, action: 'approve' });
        setActionMessage(null);
        try {
          const res = await api.post(`/users/drivers/${driverId}/approve`);
          const smsFeedback = res.data.sms?.feedback || '';
          setActionMessage({ 
            type: 'success', 
            text: `✓ ${res.data.message}`,
            subText: smsFeedback
          });
          fetchUsersSummary(true);
        } catch (error: any) {
          const errText = error.response?.data?.message || 'Failed to approve driver application.';
          setActionMessage({ type: 'error', text: errText });
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  // 1b. Re-Approve Driver Application
  const handleReapproveDriver = (driverId: number, driverName: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Re-Approve Driver Account',
      message: (
        <div className="space-y-2">
          <p>Re-approve driver account for <strong className="text-gray-900 dark:text-white">{driverName}</strong>?</p>
          <p className="text-xs text-gray-500">This will re-activate the account, restore approved status, and dispatch a new SMS notification.</p>
        </div>
      ),
      confirmText: 'Re-Approve',
      variant: 'success',
      onClose: () => setConfirmConfig(null),
      onConfirm: async () => {
        setConfirmConfig(null);
        setActionLoadingId({ id: driverId, action: 'reapprove' });
        setActionMessage(null);
        try {
          const res = await api.post(`/users/drivers/${driverId}/reapprove`);
          const smsFeedback = res.data.sms?.feedback || '';
          setActionMessage({ 
            type: 'success', 
            text: `✓ ${res.data.message}`,
            subText: smsFeedback
          });
          fetchUsersSummary(true);
        } catch (error: any) {
          const errText = error.response?.data?.message || 'Failed to re-approve driver account.';
          setActionMessage({ type: 'error', text: errText });
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  // 2. Open Reject Driver Modal
  const openRejectModal = (driverId: number, driverName: string) => {
    setRejectTargetDriver({ id: driverId, name: driverName });
    setRejectReason('Application did not meet vehicle and verification standards.');
    setRejectModalOpen(true);
  };

  // 3. Confirm Reject Driver
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetDriver) return;

    setSubmittingReject(true);
    setActionMessage(null);
    try {
      const res = await api.post(`/users/drivers/${rejectTargetDriver.id}/reject`, {
        reason: rejectReason
      });
      setActionMessage({ 
        type: 'info', 
        text: `Application for ${rejectTargetDriver.name} marked as Rejected.`,
        subText: `Reason: ${rejectReason}`
      });
      setRejectModalOpen(false);
      setRejectTargetDriver(null);
      fetchUsersSummary(true);
    } catch (error: any) {
      const errText = error.response?.data?.message || 'Failed to reject driver application.';
      setActionMessage({ type: 'error', text: errText });
    } finally {
      setSubmittingReject(false);
    }
  };

  // 4. Resend / Retry Approval SMS
  const handleResendSms = (driverId: number, driverName: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Resend SMS Notification',
      message: `Resend approval SMS notification to ${driverName}? This will trigger an SMS dispatch via Semaphore.`,
      confirmText: 'Resend SMS',
      variant: 'info',
      onClose: () => setConfirmConfig(null),
      onConfirm: async () => {
        setConfirmConfig(null);
        setActionLoadingId({ id: driverId, action: 'resend-sms' });
        setActionMessage(null);
        try {
          const res = await api.post(`/users/drivers/${driverId}/resend-sms`);
          setActionMessage({ 
            type: 'success', 
            text: `✓ ${res.data.message}`,
            subText: `SMS Status: ${res.data.sms?.status || 'sent'} (Ref: ${res.data.sms?.reference || 'RESENT'})`
          });
          fetchUsersSummary(true);
        } catch (error: any) {
          const errText = error.response?.data?.message || 'Failed to dispatch SMS notification.';
          setActionMessage({ type: 'error', text: errText });
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  // 4b. Delete User Account (Disallowed for Sole Admin)
  const handleDeleteUser = (user: any) => {
    if (user.email && user.email.toLowerCase() === 'junerey@gmail.com') {
      setConfirmConfig({
        isOpen: true,
        title: 'Action Restricted',
        message: 'The primary administrator account (Junerey@gmail.com) is permanently protected and cannot be deleted.',
        confirmText: 'Understood',
        cancelText: '',
        variant: 'warning',
        onClose: () => setConfirmConfig(null),
        onConfirm: () => setConfirmConfig(null)
      });
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Permanently Delete Account',
      message: (
        <div className="space-y-2">
          <p>Are you sure you want to permanently delete account <strong className="text-gray-900 dark:text-white">"{user.name}"</strong> ({user.email})?</p>
          <p className="text-xs text-red-500 font-semibold">This action cannot be undone. User login and profile data will be permanently purged.</p>
        </div>
      ),
      confirmText: 'Delete Account',
      variant: 'danger',
      onClose: () => setConfirmConfig(null),
      onConfirm: async () => {
        setConfirmConfig(null);
        setActionLoadingId({ id: user.id, action: 'delete' });
        setActionMessage(null);
        try {
          const res = await api.delete(`/users/${user.id}`);
          setActionMessage({ type: 'success', text: `✓ ${res.data.message}` });
          fetchUsersSummary(true);
        } catch (error: any) {
          const errText = error.response?.data?.message || 'Failed to delete account.';
          setActionMessage({ type: 'error', text: errText });
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  // 5. Toggle Active/Inactive
  const handleToggleActive = (user: any) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    setConfirmConfig({
      isOpen: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Account`,
      message: `Are you sure you want to ${action} account "${user.name}"? ${user.is_active ? 'The user will be temporarily blocked from signing in.' : 'The user will immediately regain access to the portal.'}`,
      confirmText: `${action.charAt(0).toUpperCase() + action.slice(1)} Account`,
      variant: user.is_active ? 'warning' : 'success',
      onClose: () => setConfirmConfig(null),
      onConfirm: async () => {
        setConfirmConfig(null);
        setActionMessage(null);
        try {
          const res = await api.put(`/users/${user.id}/toggle-active`);
          setActionMessage({ type: 'success', text: res.data.message });
          fetchUsersSummary(true);
        } catch (error: any) {
          const errText = error.response?.data?.message || 'Failed to update account status.';
          setActionMessage({ type: 'error', text: errText });
        }
      }
    });
  };

  // Open Create Modal for Customer / Driver / Worker
  const openCreateModal = (role: 'customer' | 'driver' | 'worker') => {
    setModalMode('create');
    setTargetRole(role);
    setEditingUserId(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setFormError('');
    setUserModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (u: any, role: 'customer' | 'driver' | 'worker') => {
    setModalMode('edit');
    setTargetRole(role);
    setEditingUserId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPhone(u.phone || '');
    setFormPassword('');
    setFormError('');
    setUserModalOpen(true);
  };

  // Submit User Create / Edit
  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName || !formEmail) {
      setFormError('Name and email are required');
      return;
    }

    if (modalMode === 'create' && (!formPassword || formPassword.length < 8)) {
      setFormError('Password must be at least 8 characters long');
      return;
    }

    setSubmittingUser(true);
    try {
      if (modalMode === 'create') {
        await api.post('/users', {
          name: formName,
          email: formEmail,
          phone: formPhone,
          password: formPassword,
          role: targetRole
        });
        setActionMessage({ type: 'success', text: `New ${targetRole} account for ${formName} created successfully.` });
      } else {
        const updatePayload: any = {
          name: formName,
          email: formEmail,
          phone: formPhone
        };
        if (formPassword) updatePayload.password = formPassword;
        await api.put(`/users/${editingUserId}`, updatePayload);
        setActionMessage({ type: 'success', text: `Account for ${formName} updated successfully.` });
      }
      setUserModalOpen(false);
      fetchUsersSummary(true);
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to save account');
    } finally {
      setSubmittingUser(false);
    }
  };

  // Filter list based on tab, search term, and status filter
  const getFilteredList = () => {
    let list: any[] = [];
    if (activeTab === 'applications') list = data.driverApplications || [];
    else if (activeTab === 'customers') list = data.customers;
    else if (activeTab === 'drivers') list = data.drivers;
    else if (activeTab === 'workers') list = data.workers;
    else if (activeTab === 'admins') list = data.admins;

    return list.filter((u) => {
      const name = u.name || u.applicant_name || '';
      const email = u.email || u.applicant_email || '';
      const phone = u.phone || u.applicant_phone || '';

      const matchesSearch = 
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.includes(searchTerm);
      
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && (u.is_active === 1 || u.user_is_active === 1)) ||
        (statusFilter === 'inactive' && (u.is_active === 0 || u.user_is_active === 0));

      return matchesSearch && matchesStatus;
    });
  };

  const currentList = getFilteredList();

  return (
    <div className="w-full max-w-full space-y-6 pb-12">


      
      {/* Top Banner / Feedback Message */}
      {actionMessage && (
        <div className={`p-4 rounded-2xl flex items-start justify-between border shadow-sm ${
          actionMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
            : actionMessage.type === 'info'
            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100'
            : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100'
        }`}>
          <div className="flex items-start gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : actionMessage.type === 'info' ? (
              <Clock className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            )}
            <div>
              <p className="text-xs sm:text-sm font-bold">{actionMessage.text}</p>
              {actionMessage.subText && (
                <p className="text-xs mt-0.5 opacity-90 font-medium">{actionMessage.subText}</p>
              )}
            </div>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            User Management & Driver Approval
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review driver applications, manage customer and worker accounts, and oversee system authorization
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'customers' && (
            <Button
              onClick={() => openCreateModal('customer')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm text-xs sm:text-sm"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          )}

          {activeTab === 'drivers' && (
            <Button
              onClick={() => openCreateModal('driver')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-sm text-xs sm:text-sm"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Add Driver
            </Button>
          )}

          {activeTab === 'workers' && (
            <Button
              onClick={() => openCreateModal('worker')}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-sm text-xs sm:text-sm"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Add Worker
            </Button>
          )}

          <button
            onClick={() => fetchUsersSummary()}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 transition-colors"
            title="Refresh Users"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Role Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl">
        
        {/* Driver Applications Tab */}
        <button
          onClick={() => setActiveTab('applications')}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'applications'
              ? 'bg-white dark:bg-gray-900 text-amber-600 dark:text-amber-400 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Driver Applications</span>
          {data.totals.pendingDrivers > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
              {data.totals.pendingDrivers} pending
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {data.driverApplications?.length || 0}
            </span>
          )}
        </button>

        {/* Customers */}
        <button
          onClick={() => setActiveTab('customers')}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'customers'
              ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customers</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {data.totals.customers}
          </span>
        </button>

        {/* Drivers */}
        <button
          onClick={() => setActiveTab('drivers')}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'drivers'
              ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Active Drivers</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            {data.totals.drivers}
          </span>
        </button>

        {/* Workers */}
        <button
          onClick={() => setActiveTab('workers')}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'workers'
              ? 'bg-white dark:bg-gray-900 text-teal-600 dark:text-teal-400 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Workers</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
            {data.totals.workers}
          </span>
        </button>

        {/* Admins */}
        <button
          onClick={() => setActiveTab('admins')}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'admins'
              ? 'bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Administrator</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            1
          </span>
        </button>
      </div>

      {/* Search and Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={`Search ${activeTab} by name, email, or phone...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium"
          >
            <option value="all">All Records</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive / Pending Only</option>
          </select>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col justify-center items-center text-gray-400 space-y-2">
            <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-xs">Loading records...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-16 text-center text-gray-400 space-y-2">
            <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No {activeTab} found</h3>
            <p className="text-xs text-gray-500">Try adjusting your search query or filter.</p>
          </div>
        ) : activeTab === 'applications' ? (
          
          /* ------------------------------------------------------------------------- */
          /* DRIVER APPLICATIONS TABLE WITH STICKY ACTION COLUMN */
          /* ------------------------------------------------------------------------- */
          <div className="overflow-x-auto relative w-full custom-scrollbar">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 uppercase tracking-wider text-[11px] border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="py-3.5 px-4 font-bold min-w-[180px]">Applicant</th>
                  <th className="py-3.5 px-4 font-bold min-w-[120px]">Phone (PH)</th>
                  <th className="py-3.5 px-4 font-bold min-w-[110px]">Applied Date</th>
                  <th className="py-3.5 px-4 font-bold min-w-[140px]">Application Status</th>
                  <th className="py-3.5 px-4 font-bold min-w-[130px]">SMS Dispatch</th>
                  <th className="py-3.5 px-4 font-bold min-w-[120px]">Reviewer Info</th>
                  <th className="py-3.5 px-4 font-bold text-right sticky right-0 bg-gray-50 dark:bg-gray-800 z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] min-w-[190px]">
                    Approval Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {currentList.map((app: DriverApplication) => {
                  const isPending = app.status === 'pending';
                  const isApproved = app.status === 'approved';
                  const isRejected = app.status === 'rejected';

                  return (
                    <tr key={app.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                      {/* Applicant */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {app.applicant_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white block">
                              {app.applicant_name}
                            </span>
                            <span className="text-[11px] text-gray-500 block">
                              {app.applicant_email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono text-gray-700 dark:text-gray-300">
                        {app.applicant_phone || 'None provided'}
                      </td>

                      {/* Applied Date */}
                      <td className="py-3.5 px-4 text-gray-500 text-xs">
                        {new Date(app.applied_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      {/* Application Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : isRejected
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isRejected && <XCircle className="w-3.5 h-3.5" />}
                          {isPending && <Clock className="w-3.5 h-3.5" />}
                          <span className="capitalize">{app.status}</span>
                        </span>
                        {app.rejection_reason && (
                          <span className="block text-[11px] text-red-600 dark:text-red-400 mt-1 max-w-[200px] truncate" title={app.rejection_reason}>
                            Reason: {app.rejection_reason}
                          </span>
                        )}
                      </td>

                      {/* SMS Dispatch Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          app.sms_status === 'sent'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : app.sms_status === 'failed'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                            : app.sms_status === 'not_configured'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`} title={app.sms_error || (app.sms_reference ? `Ref: ${app.sms_reference}` : undefined)}>
                          <MessageSquare className="w-3 h-3" />
                          <span className="capitalize">
                            {app.sms_status === 'not_configured' ? 'Not Configured' : app.sms_status}
                          </span>
                        </span>
                        {app.sms_sent_at && (
                          <span className="block text-[10px] text-gray-400 mt-0.5">
                            {new Date(app.sms_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </td>

                      {/* Reviewer Info */}
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {app.reviewed_at ? (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300 block">
                              {app.reviewer_name || 'Administrator'}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(app.reviewed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Awaiting review</span>
                        )}
                      </td>

                      {/* Approval Actions Cell (Sticky Right) */}
                      <td className="py-3.5 px-4 text-right sticky right-0 bg-white dark:bg-gray-900 z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] min-w-[190px]">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApproveDriver(app.user_id, app.applicant_name)}
                                disabled={actionLoadingId?.id === app.user_id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1.5 h-auto flex items-center gap-1 shadow-sm whitespace-nowrap"
                              >
                                <Check className={`w-3.5 h-3.5 ${actionLoadingId?.id === app.user_id && actionLoadingId?.action === 'approve' ? 'animate-spin' : ''}`} />
                                {actionLoadingId?.id === app.user_id && actionLoadingId?.action === 'approve' ? 'Approving...' : 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRejectModal(app.user_id, app.applicant_name)}
                                disabled={actionLoadingId?.id === app.user_id}
                                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 text-xs px-2.5 py-1.5 h-auto flex items-center gap-1 font-semibold whitespace-nowrap"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject
                              </Button>
                            </>
                          )}

                          {isApproved && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendSms(app.user_id, app.applicant_name)}
                              disabled={actionLoadingId?.id === app.user_id}
                              className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs px-2.5 py-1.5 h-auto flex items-center gap-1.5 border-blue-200 dark:border-blue-800 font-bold whitespace-nowrap shadow-sm"
                              title="Resend Approval SMS Notification"
                            >
                              <Send className={`w-3 h-3 ${actionLoadingId?.id === app.user_id && actionLoadingId?.action === 'resend-sms' ? 'animate-pulse' : ''}`} />
                              {actionLoadingId?.id === app.user_id && actionLoadingId?.action === 'resend-sms' ? 'Sending...' : 'Resend SMS'}
                            </Button>
                          )}

                          {isRejected && (
                            <Button
                              size="sm"
                              onClick={() => handleReapproveDriver(app.user_id, app.applicant_name)}
                              disabled={actionLoadingId?.id === app.user_id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1.5 h-auto flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                              title="Re-approve driver application and dispatch SMS"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${actionLoadingId?.id === app.user_id && actionLoadingId?.action === 'reapprove' ? 'animate-spin' : ''}`} />
                              {actionLoadingId?.id === app.user_id && actionLoadingId?.action === 'reapprove' ? 'Re-approving...' : 'Re-Approve'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        ) : (
          
          /* ------------------------------------------------------------------------- */
          /* GENERAL USERS TABLE (Customers, Active Drivers, Workers, Admins) */
          /* ------------------------------------------------------------------------- */
          <div className="overflow-x-auto relative w-full custom-scrollbar">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase tracking-wider text-[11px] border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="py-3.5 px-4 font-bold">User</th>
                  <th className="py-3.5 px-4 font-bold">Contact</th>
                  {activeTab === 'customers' && <th className="py-3.5 px-4 font-bold">Total Orders</th>}
                  {activeTab === 'drivers' && <th className="py-3.5 px-4 font-bold">Workload (Pick / Del)</th>}
                  {activeTab === 'drivers' && <th className="py-3.5 px-4 font-bold">Completed Tasks</th>}
                  {activeTab === 'workers' && <th className="py-3.5 px-4 font-bold">Processed Tasks</th>}
                  {activeTab === 'admins' && <th className="py-3.5 px-4 font-bold">Role Authority</th>}
                  <th className="py-3.5 px-4 font-bold">Registered</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right sticky right-0 bg-gray-50 dark:bg-gray-800 z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] min-w-[170px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {currentList.map((userItem) => {
                  const isActive = userItem.is_active === 1;

                  return (
                    <tr key={userItem.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                      
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0 ${
                            activeTab === 'customers' ? 'bg-blue-600' :
                            activeTab === 'drivers' ? 'bg-indigo-600' :
                            activeTab === 'workers' ? 'bg-teal-600' : 'bg-purple-600'
                          }`}>
                            {userItem.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white block">
                              {userItem.name}
                            </span>
                            <span className="text-[11px] text-gray-500 block truncate max-w-[180px]">
                              {userItem.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono text-gray-600 dark:text-gray-300">
                        {userItem.phone || 'No phone'}
                      </td>

                      {/* Role Specific Columns */}
                      {activeTab === 'customers' && (
                        <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                          <span className="inline-flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-blue-600" />
                            {userItem.total_orders || 0} order(s)
                          </span>
                        </td>
                      )}

                      {activeTab === 'drivers' && (
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            (userItem.active_pickups + userItem.active_deliveries) > 0
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {userItem.active_pickups || 0} pick / {userItem.active_deliveries || 0} del
                          </span>
                        </td>
                      )}

                      {activeTab === 'drivers' && (
                        <td className="py-3.5 px-4 font-semibold text-gray-800 dark:text-gray-200">
                          {userItem.completed_tasks || 0} tasks
                        </td>
                      )}

                      {activeTab === 'workers' && (
                        <td className="py-3.5 px-4 font-semibold text-gray-800 dark:text-gray-200">
                          {userItem.completed_processing_tasks || 0} orders
                        </td>
                      )}

                      {activeTab === 'admins' && (
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                            Primary System Administrator
                          </span>
                        </td>
                      )}

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-gray-400 text-xs">
                        {new Date(userItem.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}>
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right sticky right-0 bg-white dark:bg-gray-900 z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] min-w-[170px]">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* View details */}
                          <button
                            onClick={() => setDetailUser(userItem)}
                            title="View Details"
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Driver Specific Actions in Drivers Tab */}
                          {activeTab === 'drivers' && (
                            <button
                              onClick={() => handleResendSms(userItem.id, userItem.name)}
                              disabled={actionLoadingId === userItem.id}
                              title="Resend SMS Notification"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
                            >
                              {actionLoadingId === userItem.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Edit info (disallowed for primary admin) */}
                          {userItem.email !== 'Junerey@gmail.com' && userItem.email !== 'junerey@gmail.com' && (
                            <button
                              onClick={() => openEditModal(userItem, activeTab as any)}
                              title="Edit User"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Toggle Active Status (disallowed for admin account) */}
                          {userItem.email !== 'Junerey@gmail.com' && userItem.email !== 'junerey@gmail.com' && (
                            <button
                              onClick={() => handleToggleActive(userItem)}
                              title={isActive ? 'Deactivate Account' : 'Activate Account'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive
                                  ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete Account (CRUD: disallowed for primary admin) */}
                          {userItem.email !== 'Junerey@gmail.com' && userItem.email !== 'junerey@gmail.com' && (
                            <button
                              onClick={() => handleDeleteUser(userItem)}
                              disabled={actionLoadingId === userItem.id}
                              title="Delete User Account"
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* REJECT DRIVER REASON MODAL */}
      {/* ========================================================================= */}
      {rejectModalOpen && rejectTargetDriver && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-base text-red-600 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Reject Driver Application
              </h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300">
              Please enter the reason for rejecting <span className="font-bold">{rejectTargetDriver.name}</span>'s driver application. This explanation will be documented and visible in the driver's notifications.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Rejection Reason</label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Incomplete vehicle registration documents, invalid license number..."
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectModalOpen(false)}
                  className="w-1/2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingReject}
                  className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT USER MODAL (Customer, Driver, Worker) */}
      {/* ========================================================================= */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white capitalize">
                {modalMode === 'create' ? `Add New ${targetRole}` : `Edit ${targetRole} Account`}
              </h3>
              <button onClick={() => setUserModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUserFormSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maria@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Contact Number</label>
                <input
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300">
                  {modalMode === 'create' ? 'Password' : 'New Password (leave empty to keep current)'}
                </label>
                <input
                  type="password"
                  placeholder={modalMode === 'create' ? 'Min 8 characters' : '••••••••'}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUserModalOpen(false)}
                  className="w-1/2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingUser}
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {submittingUser ? 'Saving...' : modalMode === 'create' ? 'Create Account' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* USER DETAILS MODAL */}
      {/* ========================================================================= */}
      {detailUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Account Information</h3>
              <button onClick={() => setDetailUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-1">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase">Full Name</span>
                <p className="font-bold text-gray-900 dark:text-white text-base">{detailUser.name || detailUser.applicant_name}</p>
                <p className="text-gray-500 font-mono text-xs">{detailUser.email || detailUser.applicant_email}</p>
                <p className="text-gray-500 font-mono text-xs">{detailUser.phone || detailUser.applicant_phone || 'No phone'}</p>
              </div>

              <div className="flex justify-between items-center p-3 rounded-2xl bg-gray-50 dark:bg-gray-800">
                <span className="text-gray-500">Account Status:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  detailUser.is_active === 1 || detailUser.user_is_active === 1
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                }`}>
                  {(detailUser.is_active === 1 || detailUser.user_is_active === 1) ? 'Active' : 'Inactive / Pending'}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-2xl bg-gray-50 dark:bg-gray-800">
                <span className="text-gray-500">Registered:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {new Date(detailUser.created_at || detailUser.applied_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setDetailUser(null)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Accessible Action Confirmation Modal */}
      {confirmConfig && (
        <ConfirmModal {...confirmConfig} />
      )}

    </div>
  );
}
