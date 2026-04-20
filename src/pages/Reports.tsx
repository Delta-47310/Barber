import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Appointment, Service, Barber } from '../types';
import { motion } from 'motion/react';
import { Users, Star, Scissors, Calendar, CheckCircle } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const Reports: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const appointmentsRef = collection(db, 'appointments');
    const unsubscribe = onSnapshot(appointmentsRef, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
      setLoading(false);
    });

    const servicesRef = collection(db, 'services');
    const unsubscribeServices = onSnapshot(servicesRef, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    });

    const barbersRef = collection(db, 'barbers');
    const unsubscribeBarbers = onSnapshot(barbersRef, (snapshot) => {
      setBarbers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barber)));
    });

    return () => {
      unsubscribe();
      unsubscribeServices();
      unsubscribeBarbers();
    };
  }, []);

  // Barber Reports Data
  const barberReports = barbers
    .filter(b => b.role === 'barber')
    .map(barber => {
      const barberAppointments = appointments.filter(a => a.barberId === barber.uid);
      const completed = barberAppointments.filter(a => a.status === 'completed');
      const ratings = completed.filter(a => a.rating !== undefined).map(a => a.rating as number);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const barberServices = services.filter(s => s.barberId === barber.uid);
      
      return {
        ...barber,
        completedCount: completed.length,
        avgRating,
        services: barberServices,
        totalAppointments: barberAppointments.length
      };
    });

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
          <p className="font-bold text-neutral-400">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Barberos</h1>
        <p className="text-neutral-500">Visualiza el rendimiento individual de cada barbero</p>
      </div>

      {/* Individual Barber Reports */}
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {barberReports.map((report, i) => (
            <motion.div
              key={report.uid}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-sm"
            >
              <div className="bg-neutral-900 p-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                      {report.photoURL ? (
                        <img src={report.photoURL} alt={report.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-2xl font-bold">{report.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{report.name}</h3>
                      <p className="text-sm font-medium text-neutral-400">{report.specialty}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-amber-400 backdrop-blur-sm">
                      <Star className="h-4 w-4 fill-amber-400" />
                      <span className="text-sm font-bold">{report.avgRating > 0 ? report.avgRating.toFixed(1) : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-xs font-bold text-neutral-400 text-center italic">
                  Rendimiento del barbero actualizado en tiempo real.
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
