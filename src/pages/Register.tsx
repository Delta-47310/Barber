import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { motion } from 'motion/react';
import { User, Phone, Scissors, ShieldCheck, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isBarber, profile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    if (user) {
      if (profile) {
        setName(profile.name);
        setPhotoURL(profile.photoURL || '');
        if (profile.role === 'barber' || profile.role === 'admin') {
          setSpecialty(profile.specialty);
        }
        setIsEdit(true);
      } else {
        setName(user.displayName || '');
        if (isBarber && !isAdmin) {
          setSpecialty('Barbero Profesional');
        } else if (isAdmin) {
          setSpecialty('Master Barber');
        }
      }
    }
  }, [user, isBarber, isAdmin, profile]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name || (isBarber ? !specialty : !phone)) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isBarber || isAdmin) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30); // 30 days trial
        
        await setDoc(doc(db, 'barbers', user.uid), {
          name,
          specialty,
          photoURL,
          uid: user.uid,
          role: isAdmin ? 'admin' : 'barber',
          ...(isEdit ? {} : { 
            active: true,
            accessExpirationDate: expirationDate.toLocaleDateString('sv-SE')
          })
        }, { merge: true });
      } else {
        const clientDoc = {
          name,
          phone,
          photoURL,
          uid: user.uid,
          role: 'client',
          ...(isEdit ? {} : {
            frequentServices: [],
            registrationDate: new Date().toISOString()
          })
        };
        await setDoc(doc(db, 'clients', user.uid), clientDoc, { merge: true });
      }
      
      navigate('/');
    } catch (err: any) {
      setError('Error al registrar el perfil. Inténtalo de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setError(null);
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
          setError('La imagen es demasiado grande. Intenta con otra foto.');
          setUploading(false);
          return;
        }
        setPhotoURL(compressedBase64);
        setUploading(false);
      };

      img.onerror = () => {
        setError('Error al procesar la imagen.');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setError('Error al procesar la imagen.');
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-neutral-500">Debes iniciar sesión primero.</p>
          <button onClick={() => navigate('/login')} className="rounded-full bg-neutral-900 px-8 py-3 font-bold text-white">
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 rounded-3xl border border-neutral-100 bg-white p-8 shadow-2xl shadow-neutral-200/50"
      >
        <div className="text-center space-y-2">
          <div className="mx-auto mb-6 inline-flex rounded-2xl bg-neutral-900 p-4 text-white">
            <User className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            {isEdit ? 'Editar Perfil' : 'Completa tu Perfil'}
          </h2>
          <p className="text-neutral-500">
            {isEdit 
              ? 'Actualiza tus datos personales' 
              : (isBarber ? 'Configura tu perfil de barbero' : 'Necesitamos algunos datos para agendar tus citas')}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <div className="h-24 w-24 overflow-hidden rounded-2xl bg-neutral-100 border-2 border-neutral-200 shadow-lg">
                {photoURL ? (
                  <img 
                    src={photoURL} 
                    alt="Preview" 
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    referrerPolicy="no-referrer"
                    style={{ 
                      filter: 'contrast(1.05) brightness(1.02)',
                      boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)'
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-400">
                    <User className="h-10 w-10" />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-900" />
                  </div>
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-neutral-900 text-white shadow-lg transition-transform hover:scale-110 font-bold">
                <Camera 
                  className="h-4 w-4" 
                  style={{ 
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
                  }}
                />
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            </div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Foto de Perfil</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700">Nombre Completo</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-4 pl-12 pr-4 font-medium outline-none transition-all focus:border-neutral-900 focus:bg-white"
                required
              />
            </div>
          </div>

          {isBarber ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Especialidad</label>
              <div className="relative">
                <Scissors className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Ej: Master Barber, Fade Specialist"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-4 pl-12 pr-4 font-medium outline-none transition-all focus:border-neutral-900 focus:bg-white"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="123 456 7890"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-4 pl-12 pr-4 font-medium outline-none transition-all focus:border-neutral-900 focus:bg-white"
                  required
                />
              </div>
            </div>
          )}

          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 text-sm">
            <p className="text-neutral-500">
              Rol detectado: <span className="font-bold text-neutral-900">{isAdmin ? 'Administrador' : (isBarber ? 'Barbero' : 'Cliente')}</span>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 py-4 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Completar Registro')}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Register;
