import React from 'react';
import { motion } from 'motion/react';
import { Scissors, Calendar, Clock, Star, ShieldCheck, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Smartphone, Download } from 'lucide-react';

const Home: React.FC = () => {
  const { user, isAdmin, isBarber } = useAuth();
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-16 pb-12"
    >
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-neutral-900 px-8 py-20 text-white md:px-16">
        <div className="relative z-10 max-w-2xl space-y-6">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-block rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/60"
          >
            Estilo • Precisión • Calidad
          </motion.span>
          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Barber App <br />
            <span className="text-neutral-400 italic font-serif">Tu mejor versión</span>
          </h1>
          <p className="text-lg text-neutral-300 md:text-xl">
            Reserva tu cita en segundos y disfruta de un servicio premium diseñado para el hombre moderno.
          </p>
          {!isAdmin && (
            <div className="flex flex-wrap gap-4 pt-4">
              {isBarber ? (
                <Link
                  to="/appointments"
                  className="rounded-full bg-white px-8 py-4 text-base font-bold text-neutral-900 transition-transform hover:scale-105"
                >
                  Mis Citas
                </Link>
              ) : (
                <Link
                  to={user ? "/appointments" : "/login"}
                  className="rounded-full bg-white px-8 py-4 text-base font-bold text-neutral-900 transition-transform hover:scale-105"
                >
                  Agendar Cita
                </Link>
              )}
            </div>
          )}
        </div>
        
        {/* Background Accent */}
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-neutral-800/50 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-neutral-800/30 blur-3xl" />
      </section>

      {/* PWA Install Promo */}
      {deferredPrompt && (
        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-indigo-600 p-8 text-white shadow-2xl shadow-indigo-200"
        >
          <div className="flex flex-col items-center gap-8 md:flex-row">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Smartphone className="h-10 w-10" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="mb-2 text-2xl font-bold">Lleva tu Barbería en el Bolsillo</h2>
              <p className="text-indigo-100">Instala la aplicación para recibir notificaciones de tus citas y reservar más rápido.</p>
            </div>
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-indigo-600 transition-transform hover:scale-105 active:scale-95"
            >
              <Download className="h-5 w-5" />
              Descargar App
            </button>
          </div>
        </motion.section>
      )}

      {/* Features Grid */}
      <section className="grid gap-8 md:grid-cols-3">
        {[
          {
            title: "Citas Rápidas",
            desc: "Sistema de reserva optimizado para móviles. Sin esperas.",
            icon: <Calendar className="h-6 w-6" />,
            color: "bg-blue-50 text-blue-600"
          },
          {
            title: "Servicio Premium",
            desc: "Cortes de cabello, barba y tratamientos faciales de alta gama.",
            icon: <Star className="h-6 w-6" />,
            color: "bg-amber-50 text-amber-600"
          },
          {
            title: "Horarios Flexibles",
            desc: "Nos adaptamos a tu ritmo de vida. Consulta disponibilidad real.",
            icon: <Clock className="h-6 w-6" />,
            color: "bg-emerald-50 text-emerald-600"
          }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="group rounded-2xl border border-neutral-100 bg-white p-8 transition-all hover:shadow-xl hover:shadow-neutral-200/50"
          >
            <div className={`mb-6 inline-flex rounded-xl p-3 ${feature.color}`}>
              {feature.icon}
            </div>
            <h3 className="mb-3 text-xl font-bold text-neutral-900">{feature.title}</h3>
            <p className="text-neutral-600 leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Info Section */}
      <section className="rounded-3xl bg-neutral-100 p-8 md:p-16">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Ubicación y Contacto</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-white p-2 text-neutral-900 shadow-sm">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">Dirección</p>
                  <p className="text-neutral-600">Calle Principal #123, Centro</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-white p-2 text-neutral-900 shadow-sm">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">Horario de Atención</p>
                  <p className="text-neutral-600">Lunes a Sábado: 2:00 PM - 8:00 PM</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-white p-2 text-neutral-900 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">Protocolos de Higiene</p>
                  <p className="text-neutral-600">Herramientas esterilizadas y ambiente seguro.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-neutral-300 shadow-2xl">
            <img 
              src="https://picsum.photos/seed/barber/800/600" 
              alt="Barbería Interior" 
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default Home;
