import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Client, Appointment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Calendar, Search, History, X, CheckCircle, Clock, XCircle, Scissors, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    const clientsRef = collection(db, 'clients');
    const q = query(clientsRef, orderBy('registrationDate', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
    });

    return () => unsubscribe();
  }, []);

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );

  const handleShowHistory = async (client: Client) => {
    setSelectedClient(client);
    setLoadingHistory(true);
    setShowHistoryModal(true);
    
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef, 
        where('clientId', '==', client.uid),
        orderBy('appointmentDate', 'desc'),
        orderBy('startTime', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setClientAppointments(appointments);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'appointments');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-600 bg-emerald-50';
      case 'accepted': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-amber-600 bg-amber-50';
      case 'in-process': return 'text-purple-600 bg-purple-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-neutral-600 bg-neutral-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      case 'accepted': return <Calendar className="h-3 w-3" />;
      case 'pending': return <Clock className="h-3 w-3" />;
      case 'in-process': return <Scissors className="h-3 w-3" />;
      case 'cancelled': return <XCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Gestión de Clientes</h1>
          <p className="text-neutral-500">Consulta el historial y datos de tus clientes</p>
        </div>
        
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-neutral-200 bg-white py-3 pl-12 pr-4 font-medium outline-none transition-all focus:border-neutral-900 focus:shadow-md"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">Cargando clientes...</div>
      ) : filteredClients.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-4 rounded-3xl border-2 border-dashed border-neutral-200 bg-white">
          <User className="h-12 w-12 text-neutral-300" />
          <p className="text-neutral-500">No se encontraron clientes.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider text-neutral-500">Cliente</th>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider text-neutral-500">Teléfono</th>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider text-neutral-500">Registro</th>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider text-neutral-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredClients.map((client) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group transition-colors hover:bg-neutral-50/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                          {client.photoURL ? (
                            <img 
                              src={client.photoURL} 
                              alt={client.name} 
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-xs font-bold text-white">
                              {client.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-neutral-900">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-neutral-600">
                        <Phone className="h-4 w-4" />
                        {client.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-neutral-600">
                        <Calendar className="h-4 w-4" />
                        {format(parseISO(client.registrationDate), 'PP', { locale: es })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleShowHistory(client)}
                        className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-200"
                      >
                        <History className="h-4 w-4" />
                        Historial
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && selectedClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-xl font-bold text-white">
                    {selectedClient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">Historial de Citas</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-neutral-500">{selectedClient.name}</p>
                      {clientAppointments.some(a => a.clientRating) && (
                        <>
                          <span className="text-neutral-300">•</span>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-indigo-500 text-indigo-500" />
                            <span className="text-xs font-black text-indigo-600">
                              {(clientAppointments.reduce((acc, curr) => acc + (curr.clientRating || 0), 0) / clientAppointments.filter(a => a.clientRating).length).toFixed(1)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="rounded-xl p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-6">
                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
                    <p className="text-sm font-bold text-neutral-400">Cargando historial...</p>
                  </div>
                ) : clientAppointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                    <div className="rounded-full bg-neutral-50 p-4">
                      <Calendar className="h-8 w-8 text-neutral-300" />
                    </div>
                    <p className="text-neutral-500 font-medium">Este cliente aún no tiene citas registradas.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientAppointments.map((appointment) => (
                      <div 
                        key={appointment.id}
                        className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                            <Scissors className="h-5 w-5 text-neutral-900" />
                          </div>
                          <div>
                            <p className="font-bold text-neutral-900">{appointment.serviceName}</p>
                            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                              <span>{format(parseISO(appointment.appointmentDate), 'PPP', { locale: es })}</span>
                              <span>•</span>
                              <span>{appointment.startTime}</span>
                            </div>
                            
                            {appointment.clientRating && (
                              <div className="mt-2 flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star 
                                      key={star} 
                                      className={`h-3 w-3 ${star <= appointment.clientRating! ? 'fill-indigo-500 text-indigo-500' : 'text-neutral-200'}`} 
                                    />
                                  ))}
                                  <span className="ml-1 text-[10px] font-black text-indigo-500 uppercase tracking-widest">Reseña del Barbero</span>
                                </div>
                                {appointment.clientReview && (
                                  <p className="text-[11px] font-bold text-neutral-600 bg-neutral-100/50 p-2 rounded-lg border border-neutral-100">
                                    "{appointment.clientReview}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <div className="text-right sm:block hidden">
                            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Barbero</p>
                            <p className="text-sm font-bold text-neutral-900">{appointment.barberName}</p>
                          </div>
                          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize ${getStatusColor(appointment.status)}`}>
                            {getStatusIcon(appointment.status)}
                            {appointment.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-100 p-6">
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="w-full rounded-2xl bg-neutral-900 py-4 font-bold text-white transition-all hover:bg-neutral-800 active:scale-[0.98]"
                >
                  Cerrar Historial
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Clients;
