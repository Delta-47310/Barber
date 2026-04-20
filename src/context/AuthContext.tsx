import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Barber } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Barber | null;
  loading: boolean;
  isAdmin: boolean;
  isBarber: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isBarber: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const isHardcodedAdmin = user.email === '482400473@alumnos.utzac.edu.mx';
        
        // Check if email is in allowed_barbers
        const allowedRef = collection(db, 'allowed_barbers');
        const q = query(allowedRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        const isAllowed = !querySnapshot.empty;

        const barberDocRef = doc(db, 'barbers', user.uid);
        const clientDocRef = doc(db, 'clients', user.uid);

        // First check if profile exists in either collection
        const [barberSnap, clientSnap] = await Promise.all([
          getDoc(barberDocRef),
          getDoc(clientDocRef)
        ]);

        if (!barberSnap.exists() && !clientSnap.exists()) {
          // Create initial profile
          let role: 'admin' | 'barber' | 'client' = 'client';
          if (isHardcodedAdmin) {
            role = 'admin';
          } else if (isAllowed) {
            role = 'barber';
          }

          if (role !== 'client') {
            const expirationDate = new Date();
            expirationDate.setFullYear(expirationDate.getFullYear() + 10); // Admins get 10 years by default

            await setDoc(barberDocRef, {
              uid: user.uid,
              name: user.displayName || 'Usuario',
              email: user.email,
              specialty: role === 'admin' ? 'Administrador' : 'Barbero Profesional',
              role: role,
              active: true,
              accessExpirationDate: expirationDate.toLocaleDateString('sv-SE')
            });
          } else {
            await setDoc(clientDocRef, {
              uid: user.uid,
              name: user.displayName || 'Usuario',
              email: user.email,
              registrationDate: new Date().toISOString(),
              frequentServices: [],
              role: 'client'
            });
          }
        }

        // Listen for profile changes (prefer the one that exists, or the calculated target)
        let targetRef = (isHardcodedAdmin || isAllowed || barberSnap.exists()) ? barberDocRef : clientDocRef;
        
        // If we found a client doc but think they should be a barber/admin, eventually they might migrate,
        // but for now, we must listen to where the data actually IS.
        if (!barberSnap.exists() && clientSnap.exists()) {
          targetRef = clientDocRef;
        } else if (barberSnap.exists()) {
          targetRef = barberDocRef;
        }
        
        unsubscribeProfile = onSnapshot(targetRef, (snapshot) => {
          if (snapshot.exists()) {
            let data = snapshot.data() as Barber;
            
            // CRITICAL: Ensure photoURL persists or is merged if it exists in the other collection
            // but not in the current active one (helps with transitions between client/barber roles)
            if (!data.photoURL) {
              const otherSnap = targetRef.path === barberDocRef.path ? clientSnap : barberSnap;
              if (otherSnap && otherSnap.exists()) {
                const otherData = otherSnap.data() as any;
                if (otherData.photoURL) {
                  data = { ...data, photoURL: otherData.photoURL };
                }
              }
            }

            // Check for expiration using local date strings to avoid UTC/timezone issues
            const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
            const isExpired = data.accessExpirationDate && data.accessExpirationDate < today;

            // If it's a barber and they are disabled or expired, sign them out
            if (data.role === 'barber' && (data.active === false || isExpired)) {
              auth.signOut();
              setProfile(null);
              setUser(null);
              return;
            }
            setProfile(data);
          }
        });

      } else {
        setProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const isBarber = profile?.role === 'barber';
  const isAdmin = profile?.role === 'admin' || user?.email === '482400473@alumnos.utzac.edu.mx';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isBarber }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
