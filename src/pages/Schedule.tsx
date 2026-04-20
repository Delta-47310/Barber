import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Schedule } from '../types';
import { motion } from 'motion/react';
import { Clock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

const TimeSelect = ({ id, defaultValue, disabled }: { id: string, defaultValue: string, disabled: boolean }) => {
  const [h24, m] = defaultValue.split(':');
  const h24Int = parseInt(h24);
  const initialPeriod = h24Int >= 12 ? 'PM' : 'AM';
  const initialH12 = h24Int % 12 || 12;

  const [h12, setH12] = useState(initialH12);
  const [min, setMin] = useState(m);
  const [period, setPeriod] = useState(initialPeriod);

  // Hidden input to keep the HH:mm format for handleSave
  const h24Value = period === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
  const finalValue = `${h24Value.toString().padStart(2, '0')}:${min}`;

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" id={id} value={finalValue} />
      <select
        value={h12}
        onChange={(e) => setH12(parseInt(e.target.value))}
        disabled={disabled}
        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm font-bold outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="font-bold">:</span>
      <select
        value={min}
        onChange={(e) => setMin(e.target.value)}
        disabled={disabled}
        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm font-bold outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        {Array.from({ length: 60 }, (_, i) => i).map(m => {
          const val = m.toString().padStart(2, '0');
          return <option key={val} value={val}>{val}</option>
        })}
      </select>
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as 'AM' | 'PM')}
        disabled={disabled}
        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm font-bold outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

const SchedulePage: React.FC = () => {
  const { user, isBarber } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    if (!user) return;

    const schedulesRef = collection(db, 'schedules');
    const q = query(schedulesRef, where('barberId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
      setSchedules(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBarber || !user) return;

    setSaving(true);
    setSuccess(false);
    try {
      // For each day, update or create
      for (const day of days) {
        const existing = schedules.find(s => s.day === day);
        const startTime = (document.getElementById(`start-${day}`) as HTMLInputElement).value;
        const endTime = (document.getElementById(`end-${day}`) as HTMLInputElement).value;
        const active = (document.getElementById(`active-${day}`) as HTMLInputElement).checked;

        if (existing) {
          await updateDoc(doc(db, 'schedules', existing.id!), { startTime, endTime, active });
        } else {
          await addDoc(collection(db, 'schedules'), {
            barberId: user.uid,
            day,
            startTime,
            endTime,
            active
          });
        }
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'schedules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Configuración de Horarios</h1>
        <p className="text-neutral-500">Define tus horas de atención laboral</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">Cargando horarios...</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-sm"
        >
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              {days.map((day) => {
                const schedule = schedules.find(s => s.day === day);
                const isActive = schedule ? schedule.active : true;
                
                return (
                  <div key={day} className={`flex flex-col gap-4 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between transition-colors ${isActive ? 'border-neutral-50 bg-neutral-50/50' : 'border-neutral-100 bg-neutral-100/30 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2 shadow-sm transition-colors ${isActive ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-400'}`}>
                        <Clock className="h-5 w-5" />
                      </div>
                      <span className={`font-bold transition-colors ${isActive ? 'text-neutral-900' : 'text-neutral-400'} w-24`}>{day}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Desde</span>
                        <TimeSelect 
                          id={`start-${day}`}
                          defaultValue={schedule?.startTime || '14:00'}
                          disabled={!isActive}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Hasta</span>
                        <TimeSelect 
                          id={`end-${day}`}
                          defaultValue={schedule?.endTime || '20:00'}
                          disabled={!isActive}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          id={`active-${day}`}
                          defaultChecked={isActive}
                          className="sr-only peer"
                          onChange={(e) => {
                            // Simple UI feedback without full state refactor
                            const parent = e.target.closest('.rounded-2xl');
                            const labelText = e.target.nextElementSibling?.nextElementSibling;
                            if (parent) {
                              if (e.target.checked) {
                                parent.classList.remove('border-neutral-100', 'bg-neutral-100/30', 'opacity-60');
                                parent.classList.add('border-neutral-50', 'bg-neutral-50/50');
                                if (labelText) labelText.textContent = 'Habilitado';
                              } else {
                                parent.classList.add('border-neutral-100', 'bg-neutral-100/30', 'opacity-60');
                                parent.classList.remove('border-neutral-50', 'bg-neutral-50/50');
                                if (labelText) labelText.textContent = 'No Habilitado';
                              }
                            }
                          }}
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neutral-900"></div>
                        <span className="ml-3 text-xs font-bold uppercase tracking-wider text-neutral-400 w-28 text-right">
                          {isActive ? 'Habilitado' : 'No Habilitado'}
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <AlertCircle className="h-4 w-4" />
                <span>Los cambios se aplicarán a las nuevas citas.</span>
              </div>
              
              <div className="flex items-center gap-4">
                {success && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5 text-sm font-bold text-emerald-600"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Guardado con éxito
                  </motion.div>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-full bg-neutral-900 px-8 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                  {saving ? 'Guardando...' : 'Guardar Horarios'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default SchedulePage;
