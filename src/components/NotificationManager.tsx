import React, { useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Bell, BellOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const NotificationManager: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [permissionStatus, setPermissionStatus] = React.useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (!user || isAdmin) return;

    if (permissionStatus === 'default') {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    } else if (permissionStatus === 'granted') {
      setupNotifications();
    }
  }, [user, permissionStatus]);

  const setupNotifications = async () => {
    try {
      const token = await getToken(messaging, {
        vapidKey: 'BId_X_placeholder_vapid_key' // In a real app, you'd generate this in Firebase Console
      });

      if (token) {
        // Save token to backend
        await fetch('/api/save-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user?.uid,
            token,
            role: profile?.role
          })
        });
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  };

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    
    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);
    setShowPrompt(false);
    
    if (permission === 'granted') {
      setupNotifications();
    }
  };

  // Listen for foreground messages
  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      // You could show a custom toast here
    });
    return () => unsubscribe();
  }, []);

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 z-[100] bg-neutral-900 text-white p-6 rounded-[2rem] shadow-2xl border border-white/10 backdrop-blur-xl"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-black text-lg">¿Activar notificaciones?</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Recibe recordatorios de tus citas y actualizaciones en tiempo real sobre tus servicios.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={requestPermission}
                  className="flex-1 bg-white text-neutral-900 py-3 rounded-xl text-sm font-black hover:bg-neutral-100 transition-colors"
                >
                  Permitir
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="px-4 py-3 bg-white/5 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors"
                >
                  Más tarde
                </button>
              </div>
            </div>
            <button onClick={() => setShowPrompt(false)} className="text-neutral-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationManager;
