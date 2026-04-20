import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Calendar, Plus, Trash2, CheckCircle2, BarChart2, Camera, Loader2, Power, PowerOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, setDoc, updateDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { Barber } from '../types';

interface AllowedBarber {
  id: string;
  email: string;
  addedAt: string;
}

const AdminProfile: React.FC = () => {
  const { user, profile } = useAuth();
  const [allowedBarbers, setAllowedBarbers] = useState<AllowedBarber[]>([]);
  const [registeredBarbers, setRegisteredBarbers] = useState<Barber[]>([]);
  const [pendingDates, setPendingDates] = useState<{ [key: string]: string }>({});
  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tempPhotoURL, setTempPhotoURL] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'allowed_barbers'), orderBy('addedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllowedBarbers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllowedBarber)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'allowed_barbers');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'barbers'), where('role', '==', 'barber'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRegisteredBarbers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barber)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'barbers');
    });
    return () => unsubscribe();
  }, []);

  const handleAddBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToAuthorize = newEmail.toLowerCase().trim();
    if (!emailToAuthorize) return;

    // Check if already authorized
    if (allowedBarbers.some(b => b.email === emailToAuthorize)) {
      setMessage({ type: 'error', text: 'Este correo ya está autorizado' });
      return;
    }

    setIsAdding(true);
    try {
      await setDoc(doc(db, 'allowed_barbers', emailToAuthorize), {
        email: emailToAuthorize,
        addedAt: new Date().toISOString()
      });
      setNewEmail('');
      setMessage({ type: 'success', text: 'Email autorizado correctamente' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'allowed_barbers');
      setMessage({ type: 'error', text: 'Error al autorizar email' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteBarber = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'allowed_barbers', id));
      setMessage({ type: 'success', text: 'Autorización eliminada' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'allowed_barbers');
    }
  };

  const toggleBarberAccess = async (barber: Barber) => {
    try {
      const newStatus = barber.active === false ? true : false;
      await updateDoc(doc(db, 'barbers', barber.uid), {
        active: newStatus
      });
      setMessage({ 
        type: 'success', 
        text: `Acceso ${newStatus ? 'habilitado' : 'deshabilitado'} para ${barber.name}` 
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'barbers');
    }
  };

  const updateBarberExpiration = async (barberId: string) => {
    const date = pendingDates[barberId];
    if (!date) return;

    try {
      const today = new Date().toLocaleDateString('sv-SE');
      const isFuture = date >= today;
      
      await updateDoc(doc(db, 'barbers', barberId), {
        accessExpirationDate: date,
        // If the new date is in the future, we ensure the manual 'active' flag is true
        // so that the barber is automatically re-enabled as requested.
        ...(isFuture ? { active: true } : {})
      });
      setMessage({ type: 'success', text: 'Fecha de vencimiento actualizada' });
      
      // Clear pending date for this barber
      setPendingDates(prev => {
        const next = { ...prev };
        delete next[barberId];
        return next;
      });

      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'barbers');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setUploadError(null);

    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
        img.src = event.target?.result as string;
      };

      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 500;
          
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
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage(img, 0, 0, width, height);
          }

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
          setTempPhotoURL(compressedBase64); // Instant preview
          
          // Dual-Update Strategy: We update BOTH collections if they exist to prevent
          // synchronization issues when AuthContext chooses a different target collection
          // after a session refresh.
          const barberDocRef = doc(db, 'barbers', user.uid);
          const clientDocRef = doc(db, 'clients', user.uid);

          const updateData: any = {
            photoURL: compressedBase64,
            uid: user.uid,
            name: profile?.name || user.displayName || 'Administrador',
            updatedAt: new Date().toISOString()
          };

          const savePromises = [
            setDoc(barberDocRef, { ...updateData, role: profile?.role || 'admin', specialty: profile?.specialty || 'Administrador Master' }, { merge: true }),
            setDoc(clientDocRef, { photoURL: compressedBase64, updatedAt: new Date().toISOString() }, { merge: true })
          ];

          await Promise.all(savePromises);
          
          setMessage({ type: 'success', text: 'Foto de perfil actualizada correctamente' });
          setTimeout(() => setMessage(null), 3000);
          setUploading(false);
        } catch (err: any) {
          console.error('Photo upload failed:', err);
          setUploadError(err.message || 'Error al actualizar la foto.');
          setUploading(false);
          setTempPhotoURL(null); // Revert on error
        }
      };

      img.onerror = () => {
        setUploadError('Error al procesar la imagen.');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setUploadError('Error al actualizar la foto.');
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-white p-8 md:p-10 rounded-[2.5rem] border border-neutral-200 shadow-sm"
      >
        {/* Subtle Background Pattern */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-neutral-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-10">
          <div className="relative group">
            <div className="h-40 w-40 rounded-[2.5rem] bg-neutral-900 flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-neutral-900/20 overflow-hidden border-4 border-white ring-1 ring-neutral-100 transition-transform duration-500 group-hover:scale-[1.02]">
              {tempPhotoURL || profile?.photoURL ? (
                <img 
                  src={tempPhotoURL || profile!.photoURL} 
                  alt={user.displayName || 'Admin'} 
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  style={{ 
                    filter: 'contrast(1.05) brightness(1.02)',
                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.1)'
                  }}
                />
              ) : (
                user.displayName?.[0] || 'A'
              )}
              
              {uploading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                </div>
              )}
            </div>
            
            <label className="absolute -bottom-2 -right-2 h-12 w-12 bg-neutral-900 text-white rounded-2xl flex items-center justify-center cursor-pointer shadow-xl border-4 border-white transition-all hover:scale-110 hover:bg-neutral-800 active:scale-95 font-bold">
              <Camera 
                className="h-6 w-6" 
                style={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <span className="px-4 py-1 bg-neutral-900 text-white border border-neutral-900 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                  Administrador Master
                </span>
                <span className="flex items-center gap-1 px-4 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                  <Shield className="h-3 w-3" /> Verificado
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-neutral-900">{user.displayName || 'Administrador'}</h1>
              {uploadError && (
                <p className="text-xs font-bold text-red-500">{uploadError}</p>
              )}
              <div className="flex flex-col md:flex-row md:items-center gap-4 text-neutral-500 font-bold text-sm">
                <p className="flex items-center justify-center md:justify-start gap-2">
                  <Mail className="h-4 w-4 text-neutral-400" /> {user.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
              <Link 
                to="/reports" 
                className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-8 py-4 text-sm font-black text-white transition-all hover:bg-neutral-800 hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
              >
                <BarChart2 className="h-4 w-4" /> Ver Reportes
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Allowed Barbers Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-neutral-200 shadow-sm space-y-8"
      >
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-neutral-900">Gestión de Barberos</h2>
          <p className="text-sm font-bold text-neutral-500">Autoriza correos electrónicos para que puedan registrarse como barberos.</p>
        </div>

        <form onSubmit={handleAddBarber} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 transition-colors group-focus-within:text-neutral-900" />
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-4 pl-12 pr-4 font-bold outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-4 focus:ring-neutral-900/5"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="rounded-2xl bg-neutral-900 px-8 py-4 text-sm font-black text-white transition-all hover:bg-neutral-800 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAdding ? 'Añadiendo...' : <><Plus className="h-5 w-5" /> Autorizar</>}
          </button>
        </form>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`flex items-center gap-2 rounded-xl p-4 text-sm font-bold ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Correos Autorizados</h3>
          <div className="grid gap-4">
            {allowedBarbers.length === 0 ? (
              <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                <p className="text-neutral-400 font-medium">No hay barberos autorizados aún.</p>
              </div>
            ) : (
              allowedBarbers.map((barber) => (
                <div
                  key={barber.id}
                  className="flex items-center justify-between p-4 bg-white rounded-2xl border border-neutral-100 hover:border-neutral-900/10 hover:bg-neutral-50/50 transition-all group/item"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-900 group-hover/item:bg-neutral-900 group-hover/item:text-white transition-colors">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold">{barber.email}</p>
                      <p className="text-xs text-neutral-400">Añadido el {new Date(barber.addedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteBarber(barber.id)}
                    className="p-2 text-neutral-400 hover:text-red-600 transition-colors opacity-0 group-hover/item:opacity-100"
                    title="Eliminar autorización"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* Registered Barbers Access Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-neutral-200 shadow-sm space-y-8"
      >
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-neutral-900">Acceso al Sistema</h2>
          <p className="text-sm font-bold text-neutral-500">Gestiona los permisos y suscripciones de los barberos.</p>
        </div>

        <div className="grid gap-4">
          {registeredBarbers.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
              <p className="text-neutral-400 font-medium">No hay barberos registrados actualmente.</p>
            </div>
          ) : (
            registeredBarbers.map((barber) => {
              const today = new Date().toLocaleDateString('sv-SE');
              const isExpired = barber.accessExpirationDate && barber.accessExpirationDate < today;
              const isActuallyActive = barber.active !== false && !isExpired;
              
              return (
                <div
                  key={barber.uid}
                  className={`flex flex-col lg:flex-row items-center justify-between p-5 md:p-6 rounded-2xl border transition-all duration-300 ${
                    isActuallyActive
                      ? 'bg-white border-neutral-100 shadow-sm hover:shadow-md' 
                      : 'bg-neutral-50 border-neutral-200 opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-4 w-full lg:w-auto mb-6 lg:mb-0">
                    <div className="relative shrink-0">
                      <div className="h-14 w-14 rounded-2xl bg-neutral-100 overflow-hidden border-2 border-white shadow-sm">
                        {barber.photoURL ? (
                          <img src={barber.photoURL} alt={barber.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-neutral-400">
                            <User className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white shadow-sm ${
                        isActuallyActive ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-base text-neutral-900 truncate">{barber.name}</p>
                      <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider truncate">{barber.specialty}</p>
                      {isExpired && (
                        <span className="inline-flex mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-widest rounded-md border border-red-200">
                          Vencido
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
                    <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-0.5">Vencimiento</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:flex-none">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                          <input 
                            type="date" 
                            value={pendingDates[barber.uid] || barber.accessExpirationDate || ''}
                            onChange={(e) => setPendingDates(prev => ({ ...prev, [barber.uid]: e.target.value }))}
                            className={`w-full sm:w-auto text-xs font-bold bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2.5 focus:bg-white focus:border-neutral-900 outline-none transition-all ${
                              isExpired ? 'text-red-600' : 'text-neutral-900'
                            }`}
                          />
                        </div>
                        <button
                          onClick={() => updateBarberExpiration(barber.uid)}
                          disabled={!pendingDates[barber.uid]}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                            pendingDates[barber.uid] 
                              ? 'bg-neutral-900 text-white shadow-md hover:bg-neutral-800 active:scale-95' 
                              : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirmar
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 pt-4 sm:pt-0 border-t sm:border-t-0 border-neutral-100 w-full sm:w-auto justify-between sm:justify-start">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Acceso</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isActuallyActive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isActuallyActive ? 'Habilitado' : 'Inhabilitado'}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => toggleBarberAccess(barber)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 ${
                          isActuallyActive ? 'bg-neutral-900' : 'bg-neutral-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                            isActuallyActive ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AdminProfile;
