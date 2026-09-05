import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import DriverDashboard from './pages/driver/DriverDashboard';
import RequestService from './pages/customer/RequestService';
import DashboardLayout from './components/layout/DashboardLayout';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex justify-center items-center h-screen text-primary">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

const RoleBasedRedirect = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex justify-center items-center h-screen text-primary">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'customer': return <Navigate to="/customer" replace />;
    case 'worker':
    case 'admin': return <Navigate to="/worker" replace />;
    case 'driver': return <Navigate to="/driver" replace />;
    default: return <Navigate to="/login" replace />;
  }
};

function AppContent() {
  const { user } = useAuth();

  // If user is not logged in, render basic routes
  if (!user) {
    return (
      <div className="min-h-screen bg-background text-on-background transition-colors duration-200">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  // If user is logged in, wrap everything in DashboardLayout
  return (
    <div className="min-h-screen bg-background text-on-background transition-colors duration-200">
      <DashboardLayout>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/" element={<RoleBasedRedirect />} />
          
          <Route path="/customer/*" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <Routes>
                <Route path="" element={<CustomerDashboard />} />
                <Route path="request" element={<RequestService />} />
              </Routes>
            </ProtectedRoute>
          } />

          <Route path="/worker/*" element={
            <ProtectedRoute allowedRoles={['worker', 'admin']}>
              <Routes>
                <Route path="" element={<WorkerDashboard />} />
              </Routes>
            </ProtectedRoute>
          } />

          <Route path="/driver/*" element={
            <ProtectedRoute allowedRoles={['driver']}>
              <Routes>
                <Route path="" element={<DriverDashboard />} />
              </Routes>
            </ProtectedRoute>
          } />
        </Routes>
      </DashboardLayout>
    </div>
  );
}

function App() {
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

export default App;
