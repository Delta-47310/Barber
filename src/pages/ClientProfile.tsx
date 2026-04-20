import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, Calendar, Scissors, ChevronRight, AlertCircle, CheckCircle, Settings, Award, Loader2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ClientProfile: React.FC = () => {
  const { user, profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [tempPhotoURL, setTempPhotoURL] = useState<string | null>(null);

  if (!user) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Security check: Only allow images
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);
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

          // Max dimensions for high performance and Firestore limits
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
          
          if (compressedBase64.length > 500000) {
            throw new Error('La imagen es demasiado grande. Intenta con otra foto.');
          }

          setTempPhotoURL(compressedBase64); // Instant preview logic

          const isHardcodedAdmin = user.email === '482400473@alumnos.utzac.edu.mx';
          const barberDocRef = doc(db, 'barbers', user.uid);
          const clientDocRef = doc(db, 'clients', user.uid);
          
          // Dual-Update Strategy: We update BOTH collections if they exist to prevent
          // synchronization issues when AuthContext chooses a different target collection
          // after a session refresh.
          const updateData: any = {
            photoURL: compressedBase64,
            uid: user.uid,
            name: profile?.name || user.displayName || 'Usuario',
            updatedAt: new Date().toISOString()
          };

          // For the document being edited, we also ensure the role is preserved
          const profileRole = profile?.role || (isHardcodedAdmin ? 'admin' : 'client');
          
          const savePromises = [];
          
          // Always update the calculated target
          const primaryRef = (isHardcodedAdmin || profile?.role === 'admin' || profile?.role === 'barber') ? barberDocRef : clientDocRef;
          savePromises.push(setDoc(primaryRef, { ...updateData, role: profileRole }, { merge: true }));
          
          // Also update the "other" one if it exists to ensure persistence across role transitions
          const secondaryRef = primaryRef.path === barberDocRef.path ? clientDocRef : barberDocRef;
          savePromises.push(setDoc(secondaryRef, { photoURL: compressedBase64, updatedAt: new Date().toISOString() }, { merge: true }));

          await Promise.all(savePromises);
          
          setUploading(false);
          setSuccessMessage('¡Foto de perfil actualizada con éxito!');
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
          console.error('Photo upload failed:', err);
          setError(err.message || 'Error al actualizar la foto de perfil.');
          setUploading(false);
          setTempPhotoURL(null); // Revert on error
        }
      };

      img.onerror = () => {
        setError('Error al procesar la imagen.');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Initial upload error:', err);
      setError('Error al iniciar la subida.');
      setUploading(false);
    }
  };

  const isBarber = profile?.role === 'barber';

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <AnimatePresence>
        {(error || successMessage) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm border ${
              error ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
            }`}
          >
            {error ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
            {error || successMessage}
            <button onClick={() => { setError(null); setSuccessMessage(null); }} className="ml-auto p-1 hover:bg-black/5 rounded-lg transition-colors">
              <ChevronRight className="h-4 w-4 rotate-90" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Header - Modern & Clean */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-white p-8 md:p-10 rounded-[2.5rem] border border-neutral-200 shadow-sm"
      >
        {/* Subtle Background Pattern */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-neutral-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-10">
          <div className="relative group">
            <div id="profile-photo-container" className="h-40 w-40 rounded-[2.5rem] bg-neutral-900 flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-neutral-900/20 overflow-hidden border-4 border-white ring-1 ring-neutral-100 transition-transform duration-500 group-hover:scale-[1.02] group-hover:rotate-2">
              {tempPhotoURL || profile?.photoURL ? (
                <img 
                  src={tempPhotoURL || profile!.photoURL} 
                  alt={profile?.name || 'User'} 
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  referrerPolicy="no-referrer"
                  style={{ 
                    filter: 'contrast(1.05) brightness(1.02)',
                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.1)'
                  }}
                />
              ) : (
                user.displayName?.[0] || 'U'
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                </div>
              )}
            </div>
            <label id="profile-photo-upload-label" className="absolute -bottom-2 -right-2 h-12 w-12 bg-neutral-900 text-white rounded-2xl flex items-center justify-center cursor-pointer shadow-xl border-4 border-white transition-all hover:scale-110 hover:bg-neutral-800 active:scale-95 z-10 font-bold">
              <Camera 
                className="h-6 w-6" 
                style={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              />
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
            </label>
          </div>

          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
                  isBarber 
                    ? 'bg-neutral-900 text-white border-neutral-900' 
                    : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                }`}>
                  {isBarber ? 'Barbero Profesional' : 'Cliente Frecuente'}
                </span>
                {isBarber && (
                  <span className="flex items-center gap-1 px-4 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                    <Award className="h-3 w-3" /> Verificado
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-neutral-900">{user.displayName || (isBarber ? 'Barbero' : 'Cliente')}</h1>
              <div className="flex flex-col md:flex-row md:items-center gap-4 text-neutral-500 font-bold text-sm">
                <p className="flex items-center justify-center md:justify-start gap-2">
                  <Mail className="h-4 w-4 text-neutral-400" /> {user.email}
                </p>
                {profile?.phone && (
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <Phone className="h-4 w-4 text-neutral-400" /> {profile.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
              <Link 
                to="/register" 
                className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-8 py-4 text-sm font-black text-white transition-all hover:bg-neutral-800 hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
              >
                <Settings className="h-4 w-4" /> Editar Perfil
              </Link>
              {isBarber && (
                <Link 
                  to="/schedule" 
                  className="inline-flex items-center gap-2 rounded-2xl bg-white border-2 border-neutral-100 px-8 py-4 text-sm font-black text-neutral-900 transition-all hover:border-neutral-900 hover:shadow-lg active:scale-95"
                >
                  <Calendar className="h-4 w-4" /> Gestionar Horario
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Stats & Quick Actions */}
        <div className="lg:col-span-4 space-y-8">
          {!isBarber && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-neutral-900 p-8 rounded-[2rem] text-white space-y-6 shadow-2xl shadow-neutral-900/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="flex items-center gap-3 relative">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                  <Scissors className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-black tracking-tight">¿Nuevo look?</h3>
              </div>
              <p className="text-sm text-neutral-400 font-medium leading-relaxed">Agenda tu próxima cita con tu barbero favorito en segundos.</p>
              <Link 
                to="/appointments" 
                className="block w-full text-center rounded-2xl bg-white py-4 text-sm font-black text-neutral-900 transition-all hover:bg-neutral-100 hover:shadow-xl hover:-translate-y-1 active:scale-95"
              >
                Agendar Ahora
              </Link>
            </motion.div>
          )}
        </div>

        {/* Right Column: Appointments */}
        <div className="lg:col-span-8 space-y-12">
          {/* Content removed as requested */}
        </div>
      </div>
    </div>
  );
};

export default ClientProfile;
