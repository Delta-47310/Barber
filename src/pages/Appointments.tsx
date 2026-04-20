import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Appointment, Service, AppointmentStatus, Schedule, Barber } from '../types';
import { format, addMinutes, startOfDay, endOfDay, isBefore, parseISO, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Calendar as CalendarIcon, Clock, User, Scissors, X, Check, AlertCircle, CheckCircle2, Star, StarHalf, ChevronLeft, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';

const RatingPicker: React.FC<{ 
  value: number; 
  onChange: (val: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const calculateRating = (clientX: number) => {
    if (!containerRef.current) return 0;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - left;
    const percentage = Math.max(0, Math.min(1, relativeX / width));
    const rawRating = percentage * 5;
    // Redondear al 0.5 más cercano
    const rating = Math.ceil(rawRating * 2) / 2;
    return rating === 0 ? 0.5 : rating;
  };

  const handlePointerMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (disabled) return;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.PointerEvent).clientX;
    setHover(calculateRating(clientX));
  };

  const handlePointerDown = (e: React.PointerEvent | React.TouchEvent) => {
    if (disabled) return;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.PointerEvent).clientX;
    setHover(calculateRating(clientX));
  };

  const handlePointerUp = () => {
    if (disabled || hover === null) return;
    onChange(hover);
    setHover(null);
  };

  return (
    <div className="flex items-center gap-2">
      <div 
        ref={containerRef}
        className={`flex items-center gap-1 touch-none p-1 -m-1 ${disabled ? '' : 'cursor-pointer'}`}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => !disabled && setHover(null)}
        onTouchMove={handlePointerMove}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const displayValue = hover ?? value;
          const isFull = displayValue >= star;
          const isHalf = displayValue >= star - 0.5 && displayValue < star;
          
          return (
            <div key={star} className="relative pointer-events-none transition-transform active:scale-110">
              {isFull ? (
                <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
              ) : isHalf ? (
                <div className="relative">
                  <Star className="h-7 w-7 text-neutral-200" />
                  <div className="absolute inset-0 overflow-hidden w-1/2">
                    <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
                  </div>
                </div>
              ) : (
                <Star className="h-7 w-7 text-neutral-200" />
              )}
            </div>
          );
        })}
      </div>
      <span className="text-sm font-bold text-neutral-500 w-8">
        {(hover ?? value) > 0 ? (hover ?? value).toFixed(1) : '0.0'}
      </span>
    </div>
  );
};

const RatingSection: React.FC<{ 
  appointmentId: string; 
  initialRating?: number;
  onConfirm: (id: string, rating: number) => void;
}> = ({ appointmentId, initialRating, onConfirm }) => {
  const [localRating, setLocalRating] = useState(initialRating || 0);
  const [isConfirmed, setIsConfirmed] = useState(!!initialRating);

  if (isConfirmed || initialRating) {
    return (
      <div className="mt-6 space-y-3 rounded-2xl bg-neutral-50 p-4 border border-neutral-100">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Tu calificación</p>
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-bold text-neutral-900">{(initialRating || localRating).toFixed(1)}</span>
        </div>
        <p className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
          <Check className="h-3 w-3" /> ¡Gracias por tu calificación!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3 rounded-2xl bg-neutral-50 p-4 border border-neutral-100">
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Califica tu experiencia</p>
      <RatingPicker 
        value={localRating} 
        onChange={setLocalRating}
      />
      <button
        onClick={() => {
          if (localRating > 0) {
            onConfirm(appointmentId, localRating);
            setIsConfirmed(true);
          }
        }}
        disabled={localRating === 0}
        className="w-full mt-2 rounded-xl bg-neutral-900 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Confirmar Calificación
      </button>
    </div>
  );
};

const ClientRatingPicker: React.FC<{ 
  value: number; 
  onChange: (val: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const calculateRating = (clientX: number) => {
    if (!containerRef.current) return 0;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - left;
    const percentage = Math.max(0, Math.min(1, relativeX / width));
    const rawRating = percentage * 5;
    const rating = Math.ceil(rawRating); // For client rating, we use full stars 1-5
    return rating === 0 ? 1 : rating;
  };

  const handlePointerMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (disabled) return;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.PointerEvent).clientX;
    setHover(calculateRating(clientX));
  };

  const handlePointerDown = (e: React.PointerEvent | React.TouchEvent) => {
    if (disabled) return;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.PointerEvent).clientX;
    setHover(calculateRating(clientX));
  };

  const handlePointerUp = () => {
    if (disabled || hover === null) return;
    onChange(hover);
    setHover(null);
  };

  return (
    <div className="flex items-center gap-2">
      <div 
        ref={containerRef}
        className={`flex items-center gap-1 touch-none p-1 -m-1 ${disabled ? '' : 'cursor-pointer'}`}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => !disabled && setHover(null)}
        onTouchMove={handlePointerMove}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const displayValue = hover ?? value;
          const isActive = displayValue >= star;
          
          return (
            <div key={star} className="relative pointer-events-none transition-transform active:scale-110">
              <Star className={`h-8 w-8 ${isActive ? 'fill-indigo-500 text-indigo-500' : 'text-neutral-200'}`} />
            </div>
          );
        })}
      </div>
      <span className="text-sm font-black text-indigo-500 w-8">
        {(hover ?? value) > 0 ? (hover ?? value) : '0'}
      </span>
    </div>
  );
};

const ClientRatingSection: React.FC<{ 
  appointmentId: string; 
  initialRating?: number;
  initialReview?: string;
  onConfirm: (id: string, rating: number, review?: string) => void;
}> = ({ appointmentId, initialRating, initialReview, onConfirm }) => {
  const [localRating, setLocalRating] = useState(initialRating || 0);
  const [review, setReview] = useState(initialReview || '');
  const [isConfirmed, setIsConfirmed] = useState(!!initialRating);

  if (isConfirmed || initialRating) {
    return (
      <div className="mt-6 space-y-3 rounded-2xl bg-indigo-50 p-5 border border-indigo-100">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Tu retroalimentación sobre el cliente</p>
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 fill-indigo-500 text-indigo-500" />
          <span className="font-black text-indigo-900">{initialRating || localRating}</span>
        </div>
        {(initialReview || review) && (
          <p className="text-xs font-bold text-indigo-700 italic bg-white/50 p-3 rounded-xl border border-indigo-100/50">
            "{initialReview || review}"
          </p>
        )}
        <p className="text-[10px] font-black text-indigo-500 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Información guardada para otros barberos.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5 rounded-[2rem] bg-indigo-50/50 p-6 border border-indigo-100 shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Califica al Cliente</p>
        <ClientRatingPicker 
          value={localRating} 
          onChange={setLocalRating}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Reseña opcional (pública para barberos)</p>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Ej: Cliente puntual, muy amable..."
          className="w-full rounded-2xl border border-indigo-100 bg-white p-4 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 min-h-[80px] resize-none"
        />
      </div>

      <button
        onClick={() => {
          if (localRating > 0) {
            onConfirm(appointmentId, localRating, review);
            setIsConfirmed(true);
          }
        }}
        disabled={localRating === 0}
        className="w-full rounded-2xl bg-indigo-600 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-200"
      >
        Guardar Calificación del Cliente
      </button>
    </div>
  );
};

const Appointments: React.FC = () => {
  const { user, isAdmin, isBarber, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barberSchedules, setBarberSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // View state
  const [viewDate, setViewDate] = useState(new Date());
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const currentBarberSchedule = useMemo(() => {
    if (!selectedBarber || !selectedDate) return null;
    const dayOfWeek = format(parseISO(selectedDate), 'EEEE', { locale: es }).toLowerCase();
    return barberSchedules.find(s => 
      s.barberId === selectedBarber && 
      s.day.toLowerCase() === dayOfWeek
    );
  }, [selectedBarber, selectedDate, barberSchedules]);

  // Fetch all appointments for the selected barber and date to check availability
  useEffect(() => {
    if (isModalOpen && selectedBarber && selectedDate) {
      const q = query(
        collection(db, 'appointments'),
        where('barberId', '==', selectedBarber),
        where('appointmentDate', '==', selectedDate)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setDayAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'appointments');
      });
      return () => unsubscribe();
    } else {
      setDayAppointments([]);
    }
  }, [isModalOpen, selectedBarber, selectedDate]);

  const availableSlots = useMemo(() => {
    if (!currentBarberSchedule || !currentBarberSchedule.active) return [];
    
    const slots = [];
    let current = parseISO(`2000-01-01T${currentBarberSchedule.startTime}`);
    const endTime = parseISO(`2000-01-01T${currentBarberSchedule.endTime}`);
    const now = new Date();
    const isToday = selectedDate === format(now, 'yyyy-MM-dd');
    
    while (isBefore(current, endTime)) {
      const slotStartTime = format(current, 'HH:mm');
      const slotEndTime = format(addMinutes(current, 30), 'HH:mm');
      
      const isOccupied = dayAppointments.some(app => 
        app.status !== 'cancelled' &&
        ((slotStartTime >= app.startTime && slotStartTime < app.endTime) ||
         (slotEndTime > app.startTime && slotEndTime <= app.endTime) ||
         (slotStartTime <= app.startTime && slotEndTime >= app.endTime))
      );

      const isPast = isToday && isBefore(parseISO(`${selectedDate}T${slotStartTime}`), now);
      
      slots.push({
        time: slotStartTime,
        occupied: isOccupied,
        past: isPast
      });
      current = addMinutes(current, 30); // 30 min intervals
    }
    return slots;
  }, [currentBarberSchedule, dayAppointments, selectedDate]);

  useEffect(() => {
    if (currentBarberSchedule && currentBarberSchedule.active) {
      const currentSlot = availableSlots.find(s => s.time === selectedTime);
      if (!selectedTime || !currentSlot || currentSlot.occupied || currentSlot.past) {
        // Find first available slot
        const firstAvailable = availableSlots.find(s => !s.occupied && !s.past);
        if (firstAvailable) setSelectedTime(firstAvailable.time);
        else setSelectedTime('');
      }
    }
  }, [currentBarberSchedule, availableSlots, selectedTime]);

  useEffect(() => {
    if (!user) return;

    const appointmentsRef = collection(db, 'appointments');
    let q;
    if (isAdmin) {
      q = query(appointmentsRef, orderBy('appointmentDate', 'desc'), orderBy('startTime', 'asc'));
    } else if (isBarber) {
      q = query(appointmentsRef, where('barberId', '==', user.uid), orderBy('appointmentDate', 'desc'));
    } else {
      q = query(appointmentsRef, where('clientId', '==', user.uid), orderBy('appointmentDate', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(apps);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'appointments');
    });

    // Load services
    const servicesRef = collection(db, 'services');
    const unsubscribeServices = onSnapshot(query(servicesRef, where('active', '==', true)), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    });

    // Load barbers
    const barbersRef = collection(db, 'barbers');
    const qBarbers = query(barbersRef, where('role', '==', 'barber'));
    const unsubscribeBarbers = onSnapshot(qBarbers, (snapshot) => {
      setBarbers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barber)));
    });

    // Load all schedules to check availability
    const schedulesRef = collection(db, 'schedules');
    const unsubscribeSchedules = onSnapshot(schedulesRef, (snapshot) => {
      setBarberSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
    });

    return () => {
      unsubscribe();
      unsubscribeServices();
      unsubscribeBarbers();
      unsubscribeSchedules();
    };
  }, [user, isAdmin, isBarber]);

  useEffect(() => {
    if (!isModalOpen) {
      setSelectedBarber('');
      setSelectedService('');
      setError(null);
    }
  }, [isModalOpen]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService) return;

    const service = services.find(s => s.id === selectedService);
    if (!service) return;

    const startTime = selectedTime;
    const now = new Date();
    const appointmentDateTime = parseISO(`${selectedDate}T${startTime}`);
    const maxDate = addDays(startOfDay(now), 15);
    
    if (isBefore(appointmentDateTime, now)) {
      setError('No puedes agendar citas en el pasado.');
      return;
    }

    if (isBefore(maxDate, appointmentDateTime)) {
      setError('Solo puedes agendar citas dentro de los próximos 15 días.');
      return;
    }

    if (!currentBarberSchedule || !currentBarberSchedule.active) {
      setError('El barbero no está disponible en la fecha seleccionada.');
      return;
    }

    const endTime = format(addMinutes(appointmentDateTime, service.estimatedDuration), 'HH:mm');

    if (startTime < currentBarberSchedule.startTime || endTime > currentBarberSchedule.endTime) {
      setError(`El horario del barbero para hoy es de ${currentBarberSchedule.startTime} a ${currentBarberSchedule.endTime}.`);
      return;
    }

    // Business Logic: Check for overlaps using dayAppointments (which has all appointments for this barber)
    const overlaps = dayAppointments.filter(app => 
      app.status !== 'cancelled' &&
      ((startTime >= app.startTime && startTime < app.endTime) ||
       (endTime > app.startTime && endTime <= app.endTime) ||
       (startTime <= app.startTime && endTime >= app.endTime))
    );

    if (overlaps.length > 0) {
      setError('Este horario ya está ocupado. Por favor elige otro.');
      return;
    }

    try {
      await addDoc(collection(db, 'appointments'), {
        clientId: user.uid,
        clientName: user.displayName || profile?.name || 'Cliente',
        barberId: service.barberId,
        barberName: barbers.find(b => b.uid === service.barberId)?.name || 'Barbero',
        serviceId: service.id,
        serviceName: service.name,
        appointmentDate: selectedDate,
        startTime,
        endTime,
        status: 'pending'
      });
      setIsModalOpen(false);
      setSelectedBarber('');
      setSelectedService('');
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    }
  };

  const updateStatus = async (id: string, status: AppointmentStatus, rating?: number, clientRating?: number, clientReview?: string) => {
    try {
      const updateData: any = { status };
      if (rating !== undefined) updateData.rating = rating;
      if (clientRating !== undefined) updateData.clientRating = clientRating;
      if (clientReview !== undefined) updateData.clientReview = clientReview;
      await updateDoc(doc(db, 'appointments', id), updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'appointments');
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'pending': return <span className="px-4 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Pendiente</span>;
      case 'accepted': return <span className="px-4 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Aceptada</span>;
      case 'in-process': return <span className="px-4 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">En Proceso</span>;
      case 'completed': return <span className="px-4 py-1 bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Finalizada</span>;
      case 'cancelled': return <span className="px-4 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Cancelada</span>;
    }
  };

  const filteredAppointments = useMemo(() => {
    const dateStr = format(viewDate, 'yyyy-MM-dd');
    return appointments
      .filter(app => app.appointmentDate === dateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [appointments, viewDate]);

  const handlePrevDay = () => setViewDate(prev => addDays(prev, -1));
  const handleNextDay = () => setViewDate(prev => addDays(prev, 1));
  const handleToday = () => setViewDate(new Date());

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Agenda de Citas</h1>
          <p className="text-neutral-500 font-bold">{isBarber ? 'Gestiona tus turnos diarios' : 'Tus citas programadas'}</p>
        </div>
        {!isBarber && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-8 py-4 text-sm font-black text-white shadow-xl shadow-neutral-900/20 transition-all hover:bg-neutral-800 hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Nueva Cita
          </button>
        )}
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-[2rem] border border-neutral-200 shadow-sm">
        <button 
          onClick={handlePrevDay}
          className="p-3 rounded-2xl hover:bg-neutral-50 text-neutral-400 hover:text-neutral-900 transition-all active:scale-90"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        
        <div className="text-center">
          <button 
            onClick={handleToday}
            className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-900 mb-1 transition-colors"
          >
            Hoy
          </button>
          <h2 className="text-xl font-black text-neutral-900 capitalize">
            {format(viewDate, "EEEE, d 'de' MMMM", { locale: es })}
          </h2>
        </div>

        <button 
          onClick={handleNextDay}
          className="p-3 rounded-2xl hover:bg-neutral-50 text-neutral-400 hover:text-neutral-900 transition-all active:scale-90"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 text-neutral-900 animate-spin" />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex h-80 flex-col items-center justify-center space-y-6 rounded-[2.5rem] border-2 border-dashed border-neutral-200 bg-white p-10 text-center"
        >
          <div className="h-20 w-20 bg-neutral-50 rounded-full flex items-center justify-center">
            <CalendarIcon className="h-10 w-10 text-neutral-200" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-black text-neutral-900">No hay citas para este día</p>
            <p className="text-neutral-400 font-bold max-w-xs mx-auto">
              {isBarber ? 'Tómate un descanso o revisa otros días.' : '¿Por qué no agendas un nuevo look?'}
            </p>
          </div>
          {!isBarber && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-sm font-black text-neutral-900 underline underline-offset-8 decoration-2 decoration-neutral-200 hover:decoration-neutral-900 transition-all"
            >
              Agendar ahora
            </button>
          )}
        </motion.div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredAppointments.map((app) => (
              <motion.div
                key={app.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm transition-all hover:shadow-2xl hover:shadow-neutral-900/5 hover:-translate-y-1"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                    <Clock className="h-3.5 w-3.5" />
                    {app.startTime} - {app.endTime}
                  </div>
                  {getStatusBadge(app.status)}
                </div>

              {app.status === 'accepted' && !isBarber && !isAdmin && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-700 border border-emerald-100"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Tu Cita fue Aceptada
                </motion.div>
              )}
              
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-900 group-hover:bg-neutral-900 group-hover:text-white transition-all duration-500">
                    <Scissors className="h-6 w-6" />
                  </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">Servicio</p>
                      <p className="font-black text-lg text-neutral-900 tracking-tight">{app.serviceName}</p>
                      {services.find(s => s.id === app.serviceId)?.photoURL && (
                        <div className="mt-3 relative h-32 w-full overflow-hidden rounded-2xl border border-neutral-100">
                          <img 
                            src={services.find(s => s.id === app.serviceId)?.photoURL} 
                            alt={app.serviceName} 
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      {services.find(s => s.id === app.serviceId)?.description && (
                        <p className="mt-2 text-xs text-neutral-500 line-clamp-2 italic">{services.find(s => s.id === app.serviceId)?.description}</p>
                      )}
                    </div>
                </div>

                {!isBarber && !isAdmin && (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-2xl bg-neutral-100 border border-neutral-200">
                      {barbers.find(b => b.uid === app.barberId)?.photoURL ? (
                        <img 
                          src={barbers.find(b => b.uid === app.barberId)?.photoURL} 
                          alt={app.barberName} 
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-400">
                          <User className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">Barbero</p>
                      <p className="font-black text-neutral-900">{app.barberName}</p>
                    </div>
                  </div>
                )}

                {/* Client Info - Shown for Admins and Barbers */}
                {(isAdmin || isBarber) && (
                  <div className="flex items-center gap-4 pt-4 border-t border-neutral-50">
                    <div className="h-10 w-10 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-400">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-0.5">Cliente</p>
                      <p className="font-bold text-neutral-800">{app.clientName}</p>
                    </div>
                  </div>
                )}
              </div>

              {(isAdmin || isBarber) && app.status === 'pending' && (
                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => updateStatus(app.id!, 'accepted')}
                    className="flex-1 rounded-2xl bg-neutral-900 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-neutral-800 active:scale-95"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => updateStatus(app.id!, 'cancelled')}
                    className="flex-1 rounded-2xl border-2 border-neutral-100 py-4 text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all active:scale-95"
                  >
                    Rechazar
                  </button>
                </div>
              )}

              {(isAdmin || isBarber) && app.status === 'accepted' && (
                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => updateStatus(app.id!, 'in-process')}
                    className="flex-1 rounded-2xl bg-neutral-900 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-neutral-800 active:scale-95"
                  >
                    Iniciar
                  </button>
                  <button
                    onClick={() => updateStatus(app.id!, 'cancelled')}
                    className="flex-1 rounded-2xl border-2 border-neutral-100 py-4 text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {!isBarber && !isAdmin && (app.status === 'pending' || app.status === 'accepted') && (
                <button
                  onClick={() => updateStatus(app.id!, 'cancelled')}
                  className="mt-8 w-full rounded-2xl border-2 border-neutral-100 py-4 text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all active:scale-95"
                >
                  Cancelar Cita
                </button>
              )}

              {(isAdmin || isBarber) && app.status === 'in-process' && (
                <button
                  onClick={() => updateStatus(app.id!, 'completed')}
                  className="mt-8 w-full rounded-2xl bg-emerald-600 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 active:scale-95"
                >
                  Finalizar Servicio
                </button>
              )}

              {app.status === 'completed' && !isBarber && !isAdmin && (
                <RatingSection 
                  appointmentId={app.id!} 
                  initialRating={app.rating} 
                  onConfirm={(id, val) => updateStatus(id, 'completed', val)} 
                />
              )}

              {app.status === 'completed' && (isBarber || isAdmin) && (
                <ClientRatingSection
                  appointmentId={app.id!}
                  initialRating={app.clientRating}
                  initialReview={app.clientReview}
                  onConfirm={(id, rating, review) => updateStatus(id, 'completed', undefined, rating, review)}
                />
              )}

              {app.status === 'completed' && (isBarber || isAdmin) && app.rating && (
                <div className="mt-6 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Calificación del cliente</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-neutral-900">{app.rating.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create Appointment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Nueva Cita</h2>
                <button onClick={() => setIsModalOpen(false)} className="rounded-full p-2 hover:bg-neutral-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateAppointment} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-neutral-700">Selecciona tu Barbero:</label>
                    <div className="grid grid-cols-2 gap-3">
                      {barbers.map(b => (
                        <button
                          key={b.uid}
                          type="button"
                          onClick={() => {
                            setSelectedBarber(b.uid);
                            setSelectedService('');
                          }}
                          className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                            selectedBarber === b.uid 
                              ? 'border-neutral-900 bg-neutral-900 text-white shadow-lg' 
                              : 'border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-200'
                          }`}
                        >
                          <div className={`h-16 w-16 overflow-hidden rounded-xl bg-white/10 ${selectedBarber === b.uid ? '' : 'bg-neutral-200'}`}>
                            {b.photoURL ? (
                              <img src={b.photoURL} alt={b.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <User className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold leading-tight">{b.name}</p>
                            <p className={`text-[10px] font-medium ${selectedBarber === b.uid ? 'text-neutral-300' : 'text-neutral-400'}`}>
                              {b.specialty}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Servicios:</label>
                    <select
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-medium outline-none focus:border-neutral-900 focus:bg-white"
                      required
                      disabled={!selectedBarber}
                    >
                      <option value="">
                        {!selectedBarber ? 'Primero selecciona un barbero' : 'Selecciona un servicio'}
                      </option>
                      {services
                        .filter(s => s.barberId === selectedBarber)
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} - ${s.price} ({s.estimatedDuration} min)
                          </option>
                        ))}
                    </select>
                  </div>

                  {selectedService && (
                    <div className="space-y-3">
                      {services.find(s => s.id === selectedService)?.photoURL && (
                        <div className="relative h-48 w-full overflow-hidden rounded-2xl border-2 border-neutral-100 shadow-sm">
                          <img 
                            src={services.find(s => s.id === selectedService)?.photoURL} 
                            alt="Preview Corte" 
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      {services.find(s => s.id === selectedService)?.description && (
                        <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-100">
                          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Detalles del servicio</p>
                          <p className="text-xs text-neutral-600 leading-relaxed italic">
                            {services.find(s => s.id === selectedService)?.description}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Fecha:</label>
                    <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    max={format(addDays(new Date(), 15), 'yyyy-MM-dd')}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-medium outline-none focus:border-neutral-900 focus:bg-white"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Horarios Disponibles:
                  </label>
                  
                  {!selectedBarber ? (
                    <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                      <p className="text-xs font-bold text-neutral-400 italic">Primero elige un barbero para ver su disponibilidad.</p>
                    </div>
                  ) : !currentBarberSchedule || !currentBarberSchedule.active ? (
                    <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100">
                      <p className="text-xs font-bold text-red-500">El barbero no trabaja este día.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot) => {
                        const [h, m] = slot.time.split(':');
                        const hInt = parseInt(h);
                        const period = hInt >= 12 ? 'PM' : 'AM';
                        const h12 = hInt % 12 || 12;
                        const displayTime = `${h12}:${m} ${period}`;

                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={slot.occupied || slot.past}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold transition-all border-2 ${
                              slot.occupied || slot.past
                                ? 'bg-neutral-100 border-neutral-100 text-neutral-400 cursor-not-allowed'
                                : selectedTime === slot.time
                                ? 'bg-neutral-900 border-neutral-900 text-white shadow-md scale-105'
                                : 'bg-white border-neutral-100 text-neutral-600 hover:border-neutral-900/20'
                            }`}
                          >
                            {displayTime}
                            <div className="mt-0.5 opacity-60">
                              {slot.occupied ? 'Ocupado' : slot.past ? 'Pasado' : 'Libre'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedBarber && selectedService && selectedTime && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-neutral-900/5 p-5 border border-dashed border-neutral-200 flex gap-4"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-white flex items-center justify-center shadow-sm border border-neutral-100 text-neutral-900">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-900">Tu Compromiso</p>
                      <p className="text-[11px] text-neutral-500 leading-relaxed font-bold italic">
                        "Por favor, asiste puntualmente a tu cita. Tu tiempo y el de nuestro equipo es valioso. Si necesitas cancelar, hazlo con anticipación."
                      </p>
                    </div>
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-neutral-900 py-4 font-bold text-white transition-opacity hover:opacity-90"
                >
                  Confirmar Cita
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Appointments;
