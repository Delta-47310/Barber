import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Appointment, Service } from '../types';
import { motion } from 'motion/react';
import { Star, Calendar, CheckCircle, TrendingUp, Scissors } from 'lucide-react';

const BarberStats: React.FC = () => {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef, where('barberId', '==', profile.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
      setLoading(false);
    });

    const servicesRef = collection(db, 'services');
    const sQ = query(servicesRef, where('barberId', '==', profile.uid));
    const unsubscribeServices = onSnapshot(sQ, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    });

    return () => {
      unsubscribe();
      unsubscribeServices();
    };
  }, [profile?.uid]);

  const completed = appointments.filter(a => a.status === 'completed');
  const ratings = completed.filter(a => a.rating !== undefined).map(a => a.rating as number);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  
  const revenue = completed.reduce((acc, app) => {
    const service = services.find(s => s.id === app.serviceId);
    return acc + (service?.price || 0);
  }, 0);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
          <p className="font-bold text-neutral-400">Cargando tus estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Mis Estadísticas</h1>
        <p className="text-neutral-500">Visualiza tu rendimiento y crecimiento en la barbería</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Ingresos</p>
          </div>
          <p className="text-3xl font-black text-neutral-900">${revenue}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <Calendar className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Citas Totales</p>
          </div>
          <p className="text-3xl font-black text-neutral-900">{appointments.length}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Completadas</p>
          </div>
          <p className="text-3xl font-black text-neutral-900">{completed.length}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <Star className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Calificación</p>
          </div>
          <p className="text-3xl font-black text-neutral-900">{avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}</p>
        </motion.div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Service Breakdown */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-8 bg-white rounded-3xl border border-neutral-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-neutral-900 rounded-xl text-white">
              <Scissors className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Desglose de Servicios</h2>
          </div>

          <div className="space-y-6">
            {services.length > 0 ? (
              services.map(service => {
                const count = appointments.filter(a => a.serviceId === service.id).length;
                const percentage = appointments.length > 0 ? (count / appointments.length) * 100 : 0;
                
                return (
                  <div key={service.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm font-bold text-neutral-900">{service.name}</p>
                        <p className="text-xs text-neutral-400">{count} citas realizadas</p>
                      </div>
                      <p className="text-sm font-black text-neutral-900">{Math.round(percentage)}%</p>
                    </div>
                    <div className="h-2 w-full bg-neutral-50 rounded-full overflow-hidden border border-neutral-100">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-neutral-900 rounded-full"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <p className="text-neutral-400 italic">No hay servicios registrados para mostrar estadísticas.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Performance Message */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col justify-center p-8 bg-neutral-900 rounded-3xl text-white shadow-xl"
        >
          <h3 className="text-2xl font-bold mb-4">¡Buen trabajo, {profile?.name.split(' ')[0]}!</h3>
          <p className="text-neutral-400 leading-relaxed mb-6">
            Tus estadísticas reflejan tu compromiso con la calidad. Sigue brindando el mejor servicio para mantener tu calificación alta y aumentar tus ingresos.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Tasa de Éxito</p>
              <p className="text-xl font-bold">
                {appointments.length > 0 ? Math.round((completed.length / appointments.length) * 100) : 0}%
              </p>
            </div>
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Servicios Activos</p>
              <p className="text-xl font-bold">{services.length}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BarberStats;
