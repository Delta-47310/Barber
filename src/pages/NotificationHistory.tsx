import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, Clock, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: any;
  read: boolean;
}

const NotificationHistory: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Notificaciones</h1>
          <p className="text-neutral-500 font-medium">Historial de alertas y recordatorios</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-neutral-100">
            <div className="h-16 w-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8 text-neutral-200" />
            </div>
            <p className="text-neutral-400 font-bold">No tienes notificaciones aún.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-6 rounded-[2rem] border transition-all duration-300 ${
                  notif.read 
                    ? 'bg-white border-neutral-100 opacity-60' 
                    : 'bg-white border-neutral-900 shadow-xl shadow-neutral-900/5'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl ${notif.read ? 'bg-neutral-50 text-neutral-400' : 'bg-neutral-900 text-white'}`}>
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-black ${notif.read ? 'text-neutral-600' : 'text-neutral-900'}`}>
                        {notif.title}
                      </h3>
                      <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), "d MMM, HH:mm", { locale: es }) : 'Reciente'}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed ${notif.read ? 'text-neutral-400' : 'text-neutral-600 font-medium'}`}>
                      {notif.body}
                    </p>
                    {!notif.read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
                      >
                        <Check className="h-3 w-3" /> Marcar como leída
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationHistory;
