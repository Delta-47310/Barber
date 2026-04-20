import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Service } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Scissors, DollarSign, Clock, X, Trash2, Edit2, CheckCircle2, XCircle, Camera, Loader2 } from 'lucide-react';

const Services: React.FC = () => {
  const { user, isAdmin, isBarber, profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [active, setActive] = useState(true);
  const [photoURL, setPhotoURL] = useState('');
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    const servicesRef = collection(db, 'services');
    let q = query(servicesRef);
    
    if (isBarber && !isAdmin) {
      q = query(servicesRef, where('barberId', '==', user?.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'services');
    });

    return () => unsubscribe();
  }, [isBarber, isAdmin, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBarber || !user) return;

    const serviceData = {
      name,
      description,
      price: parseFloat(price),
      estimatedDuration: parseInt(duration),
      active,
      barberId: user.uid,
      barberName: profile?.name || 'Barbero',
      photoURL
    };

    try {
      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id!), serviceData);
      } else {
        await addDoc(collection(db, 'services'), serviceData);
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingService ? OperationType.UPDATE : OperationType.CREATE, 'services');
    }
  };

  const toggleActive = async (service: Service) => {
    if (!isBarber && !isAdmin) return;
    try {
      await updateDoc(doc(db, 'services', service.id!), { active: !service.active });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'services');
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteService = async (id: string) => {
    if (deletingId === id) return;
    
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'services', id));
      setConfirmDeleteId(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(`Error al eliminar: ${err.message || 'No tienes permisos'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const openModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setName(service.name);
      setDescription(service.description || '');
      setPrice(service.price.toString());
      setDuration(service.estimatedDuration.toString());
      setActive(service.active);
      setPhotoURL(service.photoURL || '');
    } else {
      setEditingService(null);
      setName('');
      setDescription('');
      setPrice('');
      setDuration('');
      setActive(true);
      setPhotoURL('');
    }
    setPhotoError(null);
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setPhotoError(null);
    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
        img.src = event.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setPhotoURL(compressedBase64);
        setUploading(false);
      };

      img.onerror = () => {
        setPhotoError('Error al procesar la imagen.');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setPhotoError('Error al procesar la imagen.');
      setUploading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Servicios y Precios</h1>
          <p className="text-neutral-500">Consulta nuestro catálogo de servicios premium</p>
        </div>
        {isBarber && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            <Plus className="h-5 w-5" />
            Nuevo Servicio
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">Cargando servicios...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <motion.div
              key={service.id}
              layout
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className={`group relative overflow-hidden rounded-[2.5rem] border border-neutral-200/60 bg-white shadow-sm transition-all duration-500 hover:shadow-2xl hover:shadow-neutral-900/10 ${!service.active ? 'opacity-60 grayscale' : ''}`}
            >
              {/* Service Header Illustration/Photo */}
              <div className="relative h-64 w-full overflow-hidden">
                {service.photoURL ? (
                  <img src={service.photoURL} alt={service.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-white/20">
                    <Scissors className="h-24 w-24" />
                  </div>
                )}
                
                {/* Gradient Masks */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-40" />

                {/* Status Badge */}
                <div className="absolute left-6 top-6 transition-all duration-500 group-hover:translate-x-1">
                  <div className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl transition-all ${
                    service.active 
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                      : 'border-white/20 bg-white/10 text-white/60'
                  }`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${service.active ? 'bg-emerald-500 animate-pulse' : 'bg-white/40'}`} />
                    {service.active ? 'Operativo' : 'Inactivo'}
                  </div>
                </div>
                
                {/* Admin/Barber Actions - Glassmorphism */}
                {(isBarber || isAdmin) && (
                  <div className="absolute right-6 top-6 flex gap-2 translate-y-[-10px] opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 z-20">
                    <button 
                      id={`edit-service-${service.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(service);
                      }} 
                      className="rounded-full bg-white/20 p-2.5 text-white backdrop-blur-xl border border-white/30 transition-all hover:bg-white/40 hover:scale-110 active:scale-95 shadow-lg group/btn"
                    >
                      <Edit2 className="h-4 w-4 transition-transform group-hover/btn:rotate-12" />
                    </button>
                    
                    <div className="relative">
                      <button 
                        id={`delete-service-${service.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(service.id!);
                        }} 
                        disabled={deletingId === service.id}
                        className={`rounded-full p-2.5 text-white backdrop-blur-xl border transition-all hover:scale-110 active:scale-95 shadow-lg group/del-btn ${
                          confirmDeleteId === service.id ? 'bg-red-600 border-red-400' : 'bg-red-500/40 border-red-500/40 hover:bg-red-500/60'
                        }`}
                      >
                        {deletingId === service.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>

                      <AnimatePresence>
                        {confirmDeleteId === service.id && !deletingId && (
                          <motion.div 
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="absolute right-full mr-2 top-0 flex gap-1"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteService(service.id!);
                              }}
                              className="bg-red-600 text-[10px] font-black uppercase px-3 py-2 rounded-lg text-white shadow-xl hover:bg-red-700 active:scale-95"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className="bg-white/20 backdrop-blur-md text-[10px] font-black uppercase px-3 py-2 rounded-lg text-white shadow-xl border border-white/20 hover:bg-white/30"
                            >
                              No
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Price Display Overlapping Image */}
                <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight drop-shadow-lg">{service.name}</h3>
                    {service.description && (
                      <p className="mt-1 text-xs font-medium text-white/70 line-clamp-1 max-w-[200px] italic">{service.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="rounded-2xl bg-white px-4 py-2 shadow-2xl transition-transform duration-500 group-hover:-translate-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Desde</p>
                      <p className="text-lg font-black text-neutral-900">${service.price}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-black text-neutral-400">
                    <Clock className="h-4 w-4" />
                    {service.estimatedDuration} MINUTOS
                  </div>
                  {service.barberName && (
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300">
                      BY {service.barberName}
                    </div>
                  )}
                </div>

                {(isBarber || isAdmin) && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleActive(service)}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-[1.25rem] py-4 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                        service.active 
                          ? 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-xl shadow-neutral-900/10' 
                          : 'bg-neutral-100 text-neutral-400 border border-neutral-200 hover:bg-neutral-200 hover:text-neutral-600'
                      }`}
                    >
                      {service.active ? 'Desactivar Servicio' : 'Activar Servicio'}
                    </button>
                  </div>
                )}
                
                {!isBarber && !isAdmin && user && (
                  <Link
                    to="/appointments"
                    className="flex w-full items-center justify-center gap-2 rounded-[1.25rem] bg-neutral-900 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-neutral-900/10 transition-all hover:bg-neutral-800 hover:-translate-y-0.5"
                  >
                    Reservar Ahora
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</h2>
                <button onClick={closeModal} className="rounded-full p-2 hover:bg-neutral-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700 uppercase tracking-widest text-[10px]">Imagen de Ejemplo</label>
                  <div className="relative group/photo h-40 w-full overflow-hidden rounded-2xl bg-neutral-100 border-2 border-dashed border-neutral-200">
                    {photoURL ? (
                      <img src={photoURL} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-neutral-400 gap-2">
                        <Plus className="h-8 w-8" />
                        <span className="text-xs font-bold uppercase tracking-widest">Añadir Foto</span>
                      </div>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
                      </div>
                    )}
                    <label className="absolute inset-0 cursor-pointer opacity-0 group-hover/photo:opacity-100 transition-opacity bg-neutral-900/10 flex items-center justify-center">
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                    </label>
                  </div>
                  {photoError && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">{photoError}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Nombre del Servicio</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Corte de Cabello"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-medium outline-none focus:border-neutral-900 focus:bg-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Descripción (¿Qué contiene?)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Incluye lavado, corte premium y peinado con cera mate."
                    rows={3}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-medium outline-none focus:border-neutral-900 focus:bg-white resize-none"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Precio (MXN)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="200"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-medium outline-none focus:border-neutral-900 focus:bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Duración (min)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="30"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-medium outline-none focus:border-neutral-900 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="active"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-5 w-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                  />
                  <label htmlFor="active" className="text-sm font-bold text-neutral-700">Servicio Activo</label>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-neutral-900 py-4 font-bold text-white transition-opacity hover:opacity-90"
                >
                  {editingService ? 'Guardar Cambios' : 'Crear Servicio'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Services;
