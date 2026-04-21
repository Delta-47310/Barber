import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scissors, Calendar, User, Settings, LogOut, Menu, X, BarChart2, Users, Clock, LifeBuoy, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const Navbar: React.FC = () => {
  const { user, isAdmin, isBarber, profile } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { label: 'Inicio', path: '/', icon: <Scissors className="h-5 w-5" /> },
  ];

  if (!isAdmin) {
    navItems.push({ label: 'Citas', path: '/appointments', icon: <Calendar className="h-5 w-5" /> });
  }

  if (user && !isAdmin) {
    navItems.push({ label: 'Notificaciones', path: '/notifications', icon: <Bell className="h-5 w-5" /> });
  }

  if (!isAdmin && !isBarber && user) {
    navItems.push({ label: 'Perfil', path: '/profile', icon: <User className="h-5 w-5" /> });
  }

  // Only barbers (not admins) manage their own services and schedules
  if (profile?.role === 'barber') {
    navItems.push(
      { label: 'Servicios', path: '/services', icon: <Scissors className="h-5 w-5" /> },
      { label: 'Horarios', path: '/schedule', icon: <Clock className="h-5 w-5" /> },
      { label: 'Estadísticas', path: '/statistics', icon: <BarChart2 className="h-5 w-5" /> },
      { label: 'Perfil', path: '/profile', icon: <User className="h-5 w-5" /> }
    );
  }

  // Both admins and barbers can manage and view clients
  if (isAdmin || isBarber) {
    navItems.push({ label: 'Clientes', path: '/clients', icon: <Users className="h-5 w-5" /> });
  }

  if (isAdmin) {
    navItems.push(
      { label: 'Barberos', path: '/reports', icon: <BarChart2 className="h-5 w-5" /> },
      { label: 'Perfil Admin', path: '/admin-profile', icon: <User className="h-5 w-5" /> }
    );
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-900">
            <div className="rounded-lg bg-neutral-900 p-1.5 text-white">
              <Scissors className="h-5 w-5" />
            </div>
            <span>Barber App</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex md:items-center md:gap-6">
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-all hover:bg-indigo-100 animate-pulse"
              >
                <LifeBuoy className="h-4 w-4" />
                Instalar App
              </button>
            )}
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
              >
                <LogOut className="h-5 w-5" />
                Salir
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Ingresar
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-neutral-600 hover:text-neutral-900"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="border-t border-neutral-100 bg-white md:hidden">
          <div className="flex flex-col gap-2 p-4">
            {deferredPrompt && (
              <button
                onClick={() => {
                  handleInstallClick();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-3 text-base font-bold text-indigo-600 transition-colors hover:bg-indigo-100 mb-2"
              >
                <LifeBuoy className="h-5 w-5" />
                Instalar Aplicación
              </button>
            )}
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            {user ? (
              <button
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" />
                Salir
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-neutral-900"
              >
                <User className="h-5 w-5" />
                Ingresar
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
