import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Public Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ResetPassword from './pages/auth/ResetPassword';
import GcashCheckout from './pages/payment/GcashCheckout';

// Layout
import DashboardLayout from './components/layout/DashboardLayout';

// Customer Pages
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CustomerOrders from './pages/customer/CustomerOrders';
import CustomerTracking from './pages/customer/CustomerTracking';
import CustomerPayments from './pages/customer/CustomerPayments';
import CustomerProfile from './pages/customer/CustomerProfile';
import RequestService from './pages/customer/RequestService';

// Worker & Admin Pages
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerOrders from './pages/worker/WorkerOrders';
import WorkerCustomers from './pages/worker/WorkerCustomers';
import WorkerTracking from './pages/worker/WorkerTracking';
import WorkerDrivers from './pages/worker/WorkerDrivers';
import WorkerSettings from './pages/worker/WorkerSettings';
import WorkerPayments from './pages/worker/WorkerPayments';
import WorkerUsers from './pages/worker/WorkerUsers';
import WorkerReports from './pages/worker/WorkerReports';

// Driver Pages
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverMap from './pages/driver/DriverMap';
import DriverHistory from './pages/driver/DriverHistory';
import DriverProfile from './pages/driver/DriverProfile';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-blue-600 font-semibold">
        Loading LaundriGo...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Pending Driver Protection
  if (user.role === 'driver' && (user as any).approval_status === 'pending') {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 dark:bg-gray-950 p-4 text-center">
        <div className="max-w-md p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
            🚚
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Application Pending Approval</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Your LaundriGo driver account is currently awaiting administrator review and approval. You will receive an SMS notification once your application has been approved.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const RoleBasedRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-blue-600 font-semibold">
        Loading...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'customer':
      return <Navigate to="/customer" replace />;
    case 'worker':
    case 'admin':
      return <Navigate to="/worker" replace />;
    case 'driver':
      return <Navigate to="/driver" replace />;
    default:
      return <Navigate to="/" replace />;
  }
};

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-surface-bright dark:bg-gray-950 text-on-surface dark:text-gray-100 transition-colors duration-200">
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Authentication & Account Recovery */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Payment Gateways */}
        <Route path="/gcash/checkout" element={<GcashCheckout />} />

        {/* Unified Dashboard Redirect */}
        <Route path="/dashboard" element={<RoleBasedRedirect />} />

        {/* Customer Protected Routes wrapped in DashboardLayout */}
        <Route
          path="/customer/*"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <DashboardLayout>
                <Routes>
                  <Route path="" element={<CustomerDashboard />} />
                  <Route path="orders" element={<CustomerOrders />} />
                  <Route path="request" element={<RequestService />} />
                  <Route path="tracking" element={<CustomerTracking />} />
                  <Route path="payments" element={<CustomerPayments />} />
                  <Route path="profile" element={<CustomerProfile />} />
                  <Route path="*" element={<Navigate to="/customer" replace />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Worker & Admin Protected Routes wrapped in DashboardLayout */}
        <Route
          path="/worker/*"
          element={
            <ProtectedRoute allowedRoles={['worker', 'admin']}>
              <DashboardLayout>
                <Routes>
                  <Route path="" element={<WorkerDashboard />} />
                  <Route path="orders" element={<WorkerOrders />} />
                  <Route
                    path="reports"
                    element={user?.role === 'admin' ? <WorkerReports /> : <Navigate to="/worker" replace />}
                  />
                  <Route
                    path="users"
                    element={user?.role === 'admin' ? <WorkerUsers /> : <Navigate to="/worker" replace />}
                  />
                  <Route
                    path="customers"
                    element={user?.role === 'admin' ? <Navigate to="/worker/users" replace /> : <Navigate to="/worker" replace />}
                  />
                  <Route
                    path="drivers"
                    element={user?.role === 'admin' ? <Navigate to="/worker/users" replace /> : <Navigate to="/worker" replace />}
                  />
                  <Route path="tracking" element={<WorkerTracking />} />
                  <Route path="settings" element={<WorkerSettings />} />
                  <Route path="payments" element={<WorkerPayments />} />
                  <Route path="*" element={<Navigate to="/worker" replace />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Driver Protected Routes wrapped in DashboardLayout */}
        <Route
          path="/driver/*"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DashboardLayout>
                <Routes>
                  <Route path="" element={<DriverDashboard />} />
                  <Route path="map" element={<DriverMap />} />
                  <Route path="history" element={<DriverHistory />} />
                  <Route path="profile" element={<DriverProfile />} />
                  <Route path="*" element={<Navigate to="/driver" replace />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
