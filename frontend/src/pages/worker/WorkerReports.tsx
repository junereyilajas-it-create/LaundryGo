import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, Calendar, Download, Printer, RefreshCw, DollarSign, 
  Package, Scale, Truck, Users, TrendingUp, Clock, AlertCircle, 
  CheckCircle2, ChevronDown, ChevronUp, Search, Filter, Droplets,
  Layers, ArrowUpRight, ShieldCheck, CreditCard
} from 'lucide-react';
import api from '../../services/api';
import { Button } from '../../components/ui';

interface BusinessSummary {
  totalRequests: number;
  totalApproved: number;
  totalCompleted: number;
  pendingRequests: number;
  cancelledRequests: number;
  totalWeightProcessedKg: number;
  totalRevenue: number;
  totalPaymentsReceived: number;
  outstandingBalances: number;
  activeCustomers: number;
  activeDrivers: number;
  activeWorkers: number;
  avgOrderValue: number;
  avgWeightPerCompletedOrder: number;
}

interface SalesByDayItem {
  date: string;
  orderCount: number;
  completedCount: number;
  sales: number;
  weightKg: number;
}

interface SalesByServiceItem {
  service: string;
  orderCount: number;
  completedCount: number;
  totalRevenue: number;
  totalKg: number;
  loads: number;
}

interface OrderPerformance {
  received: number;
  approved: number;
  completed: number;
  cancelled: number;
  pending: number;
  awaitingCustomerConfirmation: number;
  awaitingDriverAssignment: number;
  currentlyProcessing: number;
  awaitingDelivery: number;
  completionRate: number;
  avgTimeToApprovalMinutes: number;
  avgTimeToPickupMinutes: number;
  avgTimeToCompletionMinutes: number;
}

interface LaundryOperations {
  totalKgProcessed: number;
  totalLoadsProcessed: number;
  avgWeightPerLoad: number;
  multiLoadOrdersCount: number;
  missingWeightOrdersCount: number;
  salesByService: SalesByServiceItem[];
}

interface WorkerWorkload {
  worker: string;
  count: number;
}

interface DriverPerf {
  name: string;
  assignedPickups: number;
  completedPickups: number;
  assignedDeliveries: number;
  completedDeliveries: number;
}

interface CustomerDriverPerformance {
  newCustomerRegistrations: number;
  customersPlacedOrders: number;
  repeatCustomers: number;
  workerWorkload: WorkerWorkload[];
  driverPerformance: DriverPerf[];
}

interface TransactionRow {
  id: number;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone?: string;
  service_name: string;
  estimated_weight?: number;
  actual_weight?: number;
  load_count?: number;
  estimated_amount: number;
  final_amount: number | null;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  processing_stage?: string;
  assigned_driver?: string | null;
}

interface ReportData {
  period: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  businessSummary: BusinessSummary;
  salesRevenue: {
    grossSales: number;
    discountsRefunds: number;
    netSales: number;
    paymentsReceived: number;
    gcashPaymentsReceived: number;
    codPaymentsReceived: number;
    unpaidBalances: number;
    salesByDay: SalesByDayItem[];
    salesByService: SalesByServiceItem[];
  };
  orderPerformance: OrderPerformance;
  laundryOperations: LaundryOperations;
  customerDriverPerformance: CustomerDriverPerformance;
  transactions: TransactionRow[];
}

export default function WorkerReports() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transaction table search, sort & pagination
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<'created_at' | 'total_amount' | 'order_number'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { period };
      if (period === 'custom') {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const { data } = await api.get('/reports', { params });
      setReport(data);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Error fetching report:', err);
      setError(err.response?.data?.message || 'Failed to load business reports. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period]);

  const handlePeriodChange = (newPeriod: 'daily' | 'weekly' | 'monthly' | 'custom') => {
    setPeriod(newPeriod);
    if (newPeriod === 'daily') {
      const todayStr = new Date().toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (newPeriod === 'weekly') {
      const today = new Date();
      const past = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (newPeriod === 'monthly') {
      const today = new Date();
      const past = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }
  };

  // CSV Export
  const exportToCsv = () => {
    if (!report || !report.transactions || report.transactions.length === 0) {
      alert('No transaction records available to export.');
      return;
    }

    const headers = [
      'Order Ref',
      'Date Submitted',
      'Customer Name',
      'Contact Phone',
      'Service',
      'Estimated Weight (kg)',
      'Actual Weight (kg)',
      'Loads',
      'Estimated Price (PHP)',
      'Final Cost (PHP)',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Processing Stage',
      'Assigned Driver'
    ];

    const rows = report.transactions.map((t) => [
      t.order_number,
      new Date(t.created_at).toLocaleString(),
      `"${t.customer_name.replace(/"/g, '""')}"`,
      t.customer_phone || '',
      `"${t.service_name.replace(/"/g, '""')}"`,
      t.estimated_weight || '',
      t.actual_weight || '',
      t.load_count || 1,
      t.estimated_amount.toFixed(2),
      t.final_amount !== null ? t.final_amount.toFixed(2) : t.total_amount.toFixed(2),
      t.payment_method,
      t.payment_status,
      t.status,
      t.processing_stage || '',
      `"${(t.assigned_driver || 'None').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LaundriGo_Report_${report.period}_${report.startDate}_to_${report.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered & sorted transaction rows
  const filteredTransactions = useMemo(() => {
    if (!report) return [];
    return report.transactions.filter((t) => {
      const matchSearch =
        t.order_number.toLowerCase().includes(tableSearch.toLowerCase()) ||
        t.customer_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        t.service_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        (t.assigned_driver || '').toLowerCase().includes(tableSearch.toLowerCase());

      const matchStatus =
        tableStatusFilter === 'all'
          ? true
          : tableStatusFilter === 'completed'
          ? t.status === 'Completed' || t.status === 'Delivered'
          : tableStatusFilter === 'pending'
          ? t.status === 'Pending Approval' || t.status === 'Pending Request'
          : tableStatusFilter === 'processing'
          ? t.status === 'Processing' || t.status === 'Washing' || t.status === 'Drying' || t.status === 'Folding'
          : tableStatusFilter === 'cancelled'
          ? t.status === 'Cancelled' || t.status === 'Customer Rejected Weight Proposal'
          : true;

      return matchSearch && matchStatus;
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (sortField === 'created_at') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [report, tableSearch, tableStatusFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-none">
      
      {/* Dedicated Print-Only Stylesheet */}
      <style>{`
        @media print {
          nav, header, aside, .no-print, button, input, select {
            display: none !important;
          }
          body, .min-h-screen, div {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-header {
            display: block !important;
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          .print-table thead {
            display: table-header-group !important;
          }
          .print-table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #ddd !important;
            padding: 6px 8px !important;
            font-size: 10px !important;
            color: black !important;
          }
          .print-break-inside-avoid {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* PRINT-ONLY OFFICIAL HEADER */}
      <div className="hidden print-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-black">LaundriGo</h1>
            <p className="text-xs text-gray-700">Smart Laundry Pickup & Delivery • Poblacion, Lagonglong, Misamis Oriental</p>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold uppercase tracking-wider block">Official Business Report</span>
            <span>Period: {report?.startDate} to {report?.endDate} ({report?.period?.toUpperCase()})</span>
            <span className="block text-[10px] text-gray-500">Generated: {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : ''}</span>
          </div>
        </div>
      </div>

      {/* SCREEN PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-5 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
                Business Reports & Analytics
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Authoritative transaction ledger, revenue recognition, and logistics throughput • Poblacion, Lagonglong
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
            disabled={loading}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
            disabled={loading || !report}
            className="gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Export CSV
          </Button>

          <Button
            size="sm"
            onClick={() => window.print()}
            disabled={loading || !report}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 text-xs shadow-md shadow-blue-600/20"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* PERIOD SELECTION BAR */}
      <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
        {/* Period Selector Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1 overflow-x-auto custom-scrollbar">
          {(['daily', 'weekly', 'monthly', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                period === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {p === 'daily'
                ? 'Daily Report'
                : p === 'weekly'
                ? 'Weekly Report'
                : p === 'monthly'
                ? 'Monthly Report'
                : 'Custom Range'}
            </button>
          ))}
        </div>

        {/* Custom Range Controls or Active Interval Badge */}
        {period === 'custom' ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-mono"
            />
            <span className="text-xs text-gray-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-mono"
            />
            <Button
              size="sm"
              onClick={fetchReport}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-8"
            >
              Apply
            </Button>
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Reporting Period: <strong>{report?.startDate}</strong> to <strong>{report?.endDate}</strong> (Asia/Manila)
            </span>
          </div>
        )}
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* LOADING STATE */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm font-semibold text-gray-500">
            Calculating authoritative business metrics from database records...
          </p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          
          {/* ========================================================================= */}
          {/* SECTION B: BUSINESS SUMMARY METRIC CARDS */}
          {/* ========================================================================= */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                1. Executive Business Summary ({report.period.toUpperCase()})
              </h2>
              <span className="text-[11px] text-gray-400">
                Updated: {new Date(report.generatedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Card 1: Total Laundry Revenue */}
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/50 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                    Recognized Revenue
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  ₱{report.businessSummary.totalRevenue.toFixed(2)}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Delivered/Completed orders recognized
                </p>
              </div>

              {/* Card 2: Recorded Payments Received */}
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/50 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase text-blue-700 dark:text-blue-400">
                    Recorded Payments
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
                  ₱{report.businessSummary.totalPaymentsReceived.toFixed(2)}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Verified cash & GCash received
                </p>
              </div>

              {/* Card 3: Outstanding Customer Balances */}
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/50 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400">
                    Outstanding Balances
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                  ₱{report.businessSummary.outstandingBalances.toFixed(2)}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Unpaid or pending COD balances
                </p>
              </div>

              {/* Card 4: Total Weight Processed */}
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase text-gray-500">
                    Laundry Processed
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                    <Scale className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-2">
                  {report.businessSummary.totalWeightProcessedKg.toFixed(1)} <span className="text-sm font-semibold text-gray-500">kg</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Actual scale-measured weight
                </p>
              </div>

              {/* Card 5: Total Requests Received */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Total Requests</span>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-1">
                  {report.businessSummary.totalRequests}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  {report.businessSummary.pendingRequests} pending approval
                </span>
              </div>

              {/* Card 6: Total Approved Orders */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Approved Orders</span>
                <span className="text-lg font-extrabold text-blue-600 block mt-1">
                  {report.businessSummary.totalApproved}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Accepted into workflow
                </span>
              </div>

              {/* Card 7: Total Completed Orders */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Completed Orders</span>
                <span className="text-lg font-extrabold text-emerald-600 block mt-1">
                  {report.businessSummary.totalCompleted}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Delivered to doorstep
                </span>
              </div>

              {/* Card 8: Rejected & Cancelled */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Rejected / Cancelled</span>
                <span className="text-lg font-extrabold text-red-600 block mt-1">
                  {report.businessSummary.cancelledRequests}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Declined or canceled
                </span>
              </div>

              {/* Card 9: Avg Order Value */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Avg Completed Value</span>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-1">
                  ₱{report.businessSummary.avgOrderValue.toFixed(2)}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Per fulfilled laundry order
                </span>
              </div>

              {/* Card 10: Avg Weight per Completed Order */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Avg Order Weight</span>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-1">
                  {report.businessSummary.avgWeightPerCompletedOrder.toFixed(1)} kg
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Average laundry package
                </span>
              </div>

              {/* Card 11: Active Customers */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Active Customers</span>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-1">
                  {report.businessSummary.activeCustomers}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Registered in Poblacion
                </span>
              </div>

              {/* Card 12: Active Drivers & Staff */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Personnel</span>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-1">
                  {report.businessSummary.activeDrivers} Drivers • {report.businessSummary.activeWorkers} Staff
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Approved & active accounts
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION C & G: SALES & REVENUE VISUALIZATIONS */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Sales Trend Chart / Daily Visual Breakdown */}
            <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 print-break-inside-avoid">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Daily Revenue & Order Volume
                </h3>
                <span className="text-[10px] text-gray-400 uppercase font-bold">
                  {report.salesRevenue.salesByDay.length} Day(s) Recorded
                </span>
              </div>

              {report.salesRevenue.salesByDay.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 italic">
                  No order activity recorded within this selected date range.
                </div>
              ) : (
                <div className="space-y-3">
                  {report.salesRevenue.salesByDay.map((day) => {
                    const maxSales = Math.max(...report.salesRevenue.salesByDay.map((d) => d.sales), 100);
                    const pct = Math.min(100, Math.round((day.sales / maxSales) * 100));

                    return (
                      <div key={day.date} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                            {day.date}
                          </span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                            ₱{day.sales.toFixed(2)}{' '}
                            <span className="text-[10px] font-normal text-gray-400">
                              ({day.orderCount} order{day.orderCount !== 1 ? 's' : ''}, {day.weightKg.toFixed(1)} kg)
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sales Breakdown by Service / Package */}
            <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 print-break-inside-avoid">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  Sales Breakdown by Service Package
                </h3>
                <span className="text-[10px] text-gray-400 uppercase font-bold">
                  Package Throughput
                </span>
              </div>

              {report.salesRevenue.salesByService.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 italic">
                  No services recorded in the selected period.
                </div>
              ) : (
                <div className="space-y-3">
                  {report.salesRevenue.salesByService.map((svc) => (
                    <div
                      key={svc.service}
                      className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white block">
                          {svc.service}
                        </span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          {svc.orderCount} orders • {svc.loads} load(s) • {svc.totalKg.toFixed(1)} kg
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 block">
                          ₱{svc.totalRevenue.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {svc.completedCount} completed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ========================================================================= */}
          {/* SECTION D & E: ORDER PERFORMANCE & OPERATIONS */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Order Performance Metrics */}
            <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 print-break-inside-avoid">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Fulfillment & Turnaround
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Order Completion Rate</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {report.orderPerformance.completionRate}%
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Avg Time to Staff Approval</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {report.orderPerformance.avgTimeToApprovalMinutes} mins
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Avg Time from Approval to Pickup</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {report.orderPerformance.avgTimeToPickupMinutes} mins
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Avg Time from Pickup to Delivery</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {report.orderPerformance.avgTimeToCompletionMinutes} mins
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Currently in Processing</span>
                  <span className="font-bold text-purple-600">
                    {report.orderPerformance.currentlyProcessing} order(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Operations & Capacity */}
            <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 print-break-inside-avoid">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                Laundry Operations Capacity
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total Scale Weight Weighed</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {report.laundryOperations.totalKgProcessed} kg
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total Washing Loads Allocated</span>
                  <span className="font-bold text-blue-600">
                    {report.laundryOperations.totalLoadsProcessed} loads
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Average Weight Per Load</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {report.laundryOperations.avgWeightPerLoad} kg/load
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Overweight Multi-Load Orders</span>
                  <span className="font-bold text-amber-600">
                    {report.laundryOperations.multiLoadOrdersCount} orders (&gt; 8kg)
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Orders Awaiting Weighing</span>
                  <span className="font-bold text-gray-600 dark:text-gray-400">
                    {report.laundryOperations.missingWeightOrdersCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer & Driver Performance Summary */}
            <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 print-break-inside-avoid">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Customer & Staff Logistics
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">New Customer Registrations</span>
                  <span className="font-bold text-emerald-600">
                    {report.customerDriverPerformance.newCustomerRegistrations}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Customers Who Placed Orders</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {report.customerDriverPerformance.customersPlacedOrders}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Repeat Customers</span>
                  <span className="font-bold text-blue-600">
                    {report.customerDriverPerformance.repeatCustomers}
                  </span>
                </div>
                
                {/* Driver completed tasks */}
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Driver Delivery Stats:</span>
                  {report.customerDriverPerformance.driverPerformance.length === 0 ? (
                    <span className="text-[11px] text-gray-400 italic">No assigned drivers yet</span>
                  ) : (
                    report.customerDriverPerformance.driverPerformance.slice(0, 3).map((dp) => (
                      <div key={dp.name} className="flex justify-between text-[11px]">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{dp.name}</span>
                        <span className="text-gray-500">
                          {dp.completedPickups} pickups • {dp.completedDeliveries} deliveries
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* SECTION G & H: DETAILED TRANSACTION AUDIT TABLE */}
          {/* ========================================================================= */}
          <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Detailed Laundry Transaction Ledger
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Showing {filteredTransactions.length} transaction record(s) matching selected filters
                </p>
              </div>

              {/* Table search & status filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search ref #, customer..."
                    value={tableSearch}
                    onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                  />
                </div>

                <select
                  value={tableStatusFilter}
                  onChange={(e) => { setTableStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending Approval</option>
                  <option value="processing">Processing</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse print-table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 text-gray-500 uppercase text-[10px] font-extrabold">
                    <th className="py-2.5 px-3">Order Ref</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3">Weight (kg)</th>
                    <th className="py-2.5 px-3">Final Amount</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400 italic">
                        No transactions found for the selected period and search criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((tx) => {
                      const isCompleted = tx.status === 'Completed' || tx.status === 'Delivered';
                      const isPaid = tx.payment_status === 'paid' || tx.payment_status === 'Paid (Demo)';
                      const effectiveAmount = tx.final_amount !== null ? tx.final_amount : tx.total_amount;

                      return (
                        <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-extrabold text-blue-600 dark:text-blue-400">
                            {tx.order_number}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-gray-900 dark:text-white block">
                              {tx.customer_name}
                            </span>
                            {tx.customer_phone && (
                              <span className="text-[10px] text-gray-400 font-mono block">
                                {tx.customer_phone}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                            {tx.service_name}
                          </td>
                          <td className="py-2.5 px-3">
                            {tx.actual_weight ? (
                              <span className="font-bold text-gray-900 dark:text-white">
                                {tx.actual_weight} kg{' '}
                                {tx.load_count && tx.load_count > 1 && (
                                  <span className="text-[10px] text-blue-600 font-normal">
                                    ({tx.load_count} loads)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">
                                Est: {tx.estimated_weight || 0} kg
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-white">
                            ₱{effectiveAmount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {tx.payment_method === 'GCASH_DEMO' ? 'GCash' : tx.payment_method} • {tx.payment_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
                                  : tx.status === 'Cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                            {tx.assigned_driver || 'None'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-800 text-xs no-print">
                <span className="text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="h-7 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="h-7 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

          </div>

          {/* PRINT-ONLY SIGNATURE FOOTER */}
          <div className="hidden print-header pt-6 mt-6 border-t border-gray-300 text-xs">
            <div className="flex justify-between">
              <div>
                <p className="font-bold">Prepared by:</p>
                <div className="mt-8 border-t border-black w-48 text-center pt-1 font-semibold">
                  LaundriGo Administrator
                </div>
              </div>
              <div>
                <p className="font-bold">Approved by:</p>
                <div className="mt-8 border-t border-black w-48 text-center pt-1 font-semibold">
                  Business Owner
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-4 text-center">
              Confidential Business Document • Generated by LaundriGo Management Information System
            </p>
          </div>

        </div>
      ) : null}

    </div>
  );
}
