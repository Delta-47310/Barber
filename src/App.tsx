import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import NotificationManager from './components/NotificationManager';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Appointments from './pages/Appointments';
import Services from './pages/Services';
import Schedule from './pages/Schedule';
import Clients from './pages/Clients';
import Reports from './pages/Reports';
import AdminProfile from './pages/AdminProfile';
import ClientProfile from './pages/ClientProfile';
import BarberStats from './pages/BarberStats';
import NotificationHistory from './pages/NotificationHistory';

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean; barberOnly?: boolean; staffOnly?: boolean; notAdmin?: boolean }> = ({ children, adminOnly, barberOnly, staffOnly, notAdmin }) => {
  const { user, profile, loading, isAdmin, isBarber } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/" />;
  if (barberOnly && !isBarber) return <Navigate to="/" />;
  if (staffOnly && !isAdmin && !isBarber) return <Navigate to="/" />;
  if (notAdmin && isAdmin) return <Navigate to="/" />;

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
          <Navbar />
          <NotificationManager />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route path="/appointments" element={
                <ProtectedRoute>
                  <Appointments />
                </ProtectedRoute>
              } />
              
              <Route path="/services" element={
                <ProtectedRoute barberOnly>
                  <Services />
                </ProtectedRoute>
              } />
              
              <Route path="/schedule" element={
                <ProtectedRoute barberOnly>
                  <Schedule />
                </ProtectedRoute>
              } />
              
              <Route path="/statistics" element={
                <ProtectedRoute barberOnly>
                  <BarberStats />
                </ProtectedRoute>
              } />
              
              <Route path="/notifications" element={
                <ProtectedRoute notAdmin>
                  <NotificationHistory />
                </ProtectedRoute>
              } />
              
              <Route path="/clients" element={
                <ProtectedRoute staffOnly>
                  <Clients />
                </ProtectedRoute>
              } />
              
              <Route path="/reports" element={
                <ProtectedRoute adminOnly>
                  <Reports />
                </ProtectedRoute>
              } />
              
              <Route path="/admin-profile" element={
                <ProtectedRoute adminOnly>
                  <AdminProfile />
                </ProtectedRoute>
              } />
              
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ClientProfile />
                </ProtectedRoute>
              } />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
