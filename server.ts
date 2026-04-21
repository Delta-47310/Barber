import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import cron from 'node-cron';
import { readFileSync } from 'fs';

let __filename: string;
let __dirname: string;

try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // Fallback for CJS
  __filename = (global as any).__filename || '';
  __dirname = (global as any).__dirname || process.cwd();
}

// Initialize Firebase Admin
let db: admin.firestore.Firestore;
let fcm: admin.messaging.Messaging;

try {
  const firebaseConfig = JSON.parse(readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
  
  let credential;
  const saVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (saVar) {
    try {
      credential = admin.credential.cert(JSON.parse(saVar));
      console.log('Firebase Admin: Using Service Account from environment variable.');
    } catch (e) {
      console.error('Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT env var. Falling back to default.');
      credential = admin.credential.applicationDefault();
    }
  } else {
    credential = admin.credential.applicationDefault();
    console.log('Firebase Admin: Using Application Default Credentials.');
  }

  admin.initializeApp({
    credential,
    projectId: firebaseConfig.projectId,
  });

  db = getFirestore(firebaseConfig.firestoreDatabaseId);
  fcm = admin.messaging();
} catch (error) {
  console.error('CRITICAL: Firebase Admin initialization failed:', error);
  // Fail-safe mock if init fails to prevent server from crashing
  db = { 
    collection: () => ({ 
      doc: () => ({ set: async () => {}, get: async () => ({ exists: false, data: () => ({}) }), onSnapshot: () => () => {}, add: async () => {} }),
      onSnapshot: () => () => {},
      where: () => ({ where: () => ({ get: async () => ({ forEach: () => {} }) }) })
    }) 
  } as any;
  fcm = { send: async () => {} } as any;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to save FCM Token
  app.post('/api/save-token', async (req, res) => {
    const { uid, token, role } = req.body;
    if (!uid || !token) return res.status(400).json({ error: 'Missing uid or token' });

    try {
      await db.collection('fcm_tokens').doc(uid).set({
        token,
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving token:', error);
      res.status(500).json({ error: 'Failed to save token' });
    }
  });

  // Helper to send notification
  async function sendNotification(uid: string, title: string, body: string, data: any = {}) {
    try {
      const tokenDoc = await db.collection('fcm_tokens').doc(uid).get();
      if (!tokenDoc.exists) return;

      const { token } = tokenDoc.data()!;
      await fcm.send({
        token,
        notification: { title, body },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      });

      // Save to history
      await db.collection('notifications').add({
        uid,
        title,
        body,
        data,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error(`Error sending notification to ${uid}:`, error);
    }
  }

  // Validate Firebase connection before starting listeners/cron
  let isFirestoreConnected = true;
  try {
    await db.collection('test').limit(1).get();
    console.log('Firebase Admin: Firestore connection verified.');
  } catch (error: any) {
    if (error?.code === 7 || error?.message?.includes('PERMISSION_DENIED')) {
      console.warn('Firebase Admin: Permission Denied. Background notifications and reminders will be disabled until credentials are provided.');
      isFirestoreConnected = false;
    } else {
      console.error('Firebase Admin: Unexpected error during connection check:', error);
    }
  }

  // Listen for appointment changes
  if (isFirestoreConnected) {
    db.collection('appointments').onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const appointment = change.doc.data();
        const id = change.doc.id;

        if (change.type === 'added') {
          // New appointment
          // Notify Barber
          await sendNotification(
            appointment.barberId,
            'Nueva Cita Agendada',
            `Tienes una nueva cita con ${appointment.clientName} para el ${appointment.appointmentDate} a las ${appointment.startTime}.`,
            { appointmentId: id, type: 'new_appointment' }
          );
          // Notify Client
          await sendNotification(
            appointment.clientId,
            'Cita Confirmada',
            `Tu cita para ${appointment.serviceName} ha sido agendada para el ${appointment.appointmentDate} a las ${appointment.startTime}.`,
            { appointmentId: id, type: 'confirmation' }
          );
        } else if (change.type === 'modified') {
          // In a real app we'd compare with previous state, but for simplicity:
          if (appointment.status === 'cancelled') {
            await sendNotification(appointment.barberId, 'Cita Cancelada', `La cita de ${appointment.clientName} ha sido cancelada.`);
            await sendNotification(appointment.clientId, 'Cita Cancelada', `Tu cita para ${appointment.serviceName} ha sido cancelada.`);
          } else if (appointment.status === 'completed') {
            await sendNotification(appointment.clientId, '¡Gracias por tu visita!', `Esperamos que hayas disfrutado tu servicio de ${appointment.serviceName}. ¡Vuelve pronto!`);
          } else {
            // General modification
            await sendNotification(appointment.barberId, 'Cita Modificada', `Se han realizado cambios en la cita de ${appointment.clientName}.`);
            await sendNotification(appointment.clientId, 'Cita Modificada', `Tu cita para ${appointment.serviceName} ha sido actualizada.`);
          }
        }
      });
    }, (error) => {
      console.error('Firestore Snapshot Error:', error);
    });

    // Cron job for reminders (runs every minute)
    cron.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        const thirtyMinsLater = new Date(now.getTime() + 30 * 60000);
        const fiveMinsLater = new Date(now.getTime() + 5 * 60000);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const formatTime = (d: Date) => d.toTimeString().split(' ')[0].substring(0, 5);

        // Check for 30 min reminders
        const thirtyMinApps = await db.collection('appointments')
          .where('appointmentDate', '==', formatDate(thirtyMinsLater))
          .where('startTime', '==', formatTime(thirtyMinsLater))
          .where('status', 'in', ['pending', 'accepted'])
          .get();

        thirtyMinApps.forEach(doc => {
          const app = doc.data();
          sendNotification(app.clientId, 'Recordatorio de Cita', 'Tu cita es en 30 minutos.');
        });

        // Check for 5 min reminders
        const fiveMinApps = await db.collection('appointments')
          .where('appointmentDate', '==', formatDate(fiveMinsLater))
          .where('startTime', '==', formatTime(fiveMinsLater))
          .where('status', 'in', ['pending', 'accepted'])
          .get();

        fiveMinApps.forEach(doc => {
          const app = doc.data();
          sendNotification(app.clientId, 'Recordatorio de Cita', 'Tu cita es en 5 minutos. ¡Te esperamos!');
        });
      } catch (error) {
        console.error('[NODE-CRON][ERROR]', error);
      }
    });
  }

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
