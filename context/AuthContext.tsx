import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  onboardingComplete: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, onboardingComplete: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      // Clean up any previous Firestore listener before setting up a new one
      if (unsubFirestore) { unsubFirestore(); unsubFirestore = null; }

      setUser(u);
      if (!u) {
        setOnboardingComplete(false);
        setLoading(false);
        return;
      }

      // Use onSnapshot so the context immediately reflects Firestore writes
      // (e.g. completeOnboarding()) without waiting for the next auth event
      unsubFirestore = onSnapshot(
        doc(db, 'users', u.uid),
        snap => {
          setOnboardingComplete(snap.data()?.onboardingComplete === true);
          setLoading(false);
        },
        () => {
          setOnboardingComplete(false);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, onboardingComplete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
