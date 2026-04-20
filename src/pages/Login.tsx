import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'motion/react';
import { LogIn, Scissors, LifeBuoy } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in barbers or clients
      const barberDoc = await getDoc(doc(db, 'barbers', user.uid));
      const clientDoc = await getDoc(doc(db, 'clients', user.uid));

      if (barberDoc.exists()) {
        const data = barberDoc.data();
        const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
        const isExpired = data.accessExpirationDate && data.accessExpirationDate < today;
        
        if (data.role === 'barber' && (data.active === false || isExpired)) {
          await auth.signOut();
          setError(isExpired 
            ? 'Tu suscripción/acceso ha vencido. Contacta al administrador.' 
            : 'Tu acceso al sistema ha sido deshabilitado por el administrador.');
          return;
        }
        navigate('/');
      } else if (clientDoc.exists()) {
        navigate('/');
      } else {
        // New user, redirect to register to complete profile
        navigate('/register');
      }
    } catch (err: any) {
      setError('Error al iniciar sesión con Google. Inténtalo de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 rounded-3xl border border-neutral-100 bg-white p-8 shadow-2xl shadow-neutral-200/50"
      >
        <div className="text-center space-y-2">
          <div className="mx-auto mb-6 inline-flex rounded-2xl bg-neutral-900 p-4 text-white">
            <Scissors className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Bienvenido</h2>
          <p className="text-neutral-500">Ingresa para gestionar tus citas en Barber App</p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-6 py-4 font-bold text-neutral-700 transition-all hover:bg-neutral-50 hover:shadow-md disabled:opacity-50"
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google" 
              className="h-5 w-5" 
            />
            {loading ? 'Cargando...' : 'Continuar con Google'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
